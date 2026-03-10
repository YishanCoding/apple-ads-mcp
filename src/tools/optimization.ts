import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppleAdsClient } from "../client/api-client.js";
import type { ApiResponse, ApiListResponse, Campaign, AdGroup } from "../types/apple-ads.js";
import type { ReportingRequest, ReportResponse } from "../types/reporting.js";
import { resolveDateRange, type DatePreset } from "../utils/date-helpers.js";
import { buildSelector } from "../utils/selectors.js";
import { formatCampaignSummary, formatMetrics, formatMoney } from "../utils/formatters.js";
import { handleToolError } from "../utils/error-handler.js";
import { validateDate } from "../utils/validators.js";

export function registerOptimizationTools(server: McpServer, client: AppleAdsClient) {
  server.registerTool(
    "get_campaign_snapshot",
    {
      title: "Campaign Snapshot (All-in-One)",
      description: "Get a comprehensive snapshot of a campaign in ONE call: campaign config, all ad groups, top keywords by spend, top search terms, and daily performance trends. Designed to give AI all the context needed for optimization analysis without multiple tool calls. Start here for any campaign health check or optimization task.",
      inputSchema: {
        campaignId: z.number().describe("The campaign ID"),
        dateRange: z
          .enum(["LAST_7_DAYS", "LAST_14_DAYS", "LAST_30_DAYS", "LAST_90_DAYS"])
          .optional()
          .describe("Date range preset (default LAST_30_DAYS)"),
        topN: z.number().optional().describe("Number of top keywords/search terms to include (default 20)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ campaignId, dateRange, topN }) => {
      try {
        const preset = (dateRange ?? "LAST_30_DAYS") as DatePreset;
        const { startDate, endDate } = resolveDateRange(preset);
        const n = topN ?? 20;

        // Fetch all data in parallel
        const [campaignResp, adGroupsResp, keywordReport, searchTermReport, dailyReport] =
          await Promise.all([
            client.get<ApiResponse<Campaign>>(`/campaigns/${campaignId}`),
            client.get<ApiListResponse<AdGroup>>(`/campaigns/${campaignId}/adgroups`, { limit: "50" }),
            client.post<ReportResponse<{ keywordId: number; keyword: string; matchType: string; bidAmount: { amount: string; currency: string } }>>(
              `/reports/campaigns/${campaignId}/keywords`,
              {
                startTime: startDate,
                endTime: endDate,
                selector: buildSelector({ limit: n, sortBy: "localSpend", sortOrder: "DESCENDING" }),
                returnRowTotals: true,
              } satisfies ReportingRequest
            ),
            client.post<ReportResponse<{ searchTermText: string; keyword: string; matchType: string }>>(
              `/reports/campaigns/${campaignId}/searchterms`,
              {
                startTime: startDate,
                endTime: endDate,
                selector: buildSelector({ limit: n, sortBy: "localSpend", sortOrder: "DESCENDING" }),
                returnRowTotals: true,
              } satisfies ReportingRequest
            ),
            client.post<ReportResponse<{ campaignId: number }>>(
              "/reports/campaigns",
              {
                startTime: startDate,
                endTime: endDate,
                granularity: "DAILY",
                selector: buildSelector({
                  limit: 1,
                  sortBy: "localSpend",
                  sortOrder: "DESCENDING",
                  conditions: [{ field: "campaignId", operator: "EQUALS", values: [String(campaignId)] }],
                }),
                returnRowTotals: true,
              } satisfies ReportingRequest
            ),
          ]);

        const campaign = campaignResp.data;
        const adGroups = adGroupsResp.data;
        const keywords = keywordReport.data.reportingDataResponse.row;
        const searchTerms = searchTermReport.data.reportingDataResponse.row;
        const dailyRows = dailyReport.data.reportingDataResponse.row;

        // Build comprehensive summary
        const sections: string[] = [];

        // Campaign overview
        sections.push("=== CAMPAIGN OVERVIEW ===");
        sections.push(formatCampaignSummary(campaign));

        // Overall metrics
        if (dailyRows.length > 0) {
          sections.push("\n=== OVERALL PERFORMANCE ===");
          sections.push(`Period: ${startDate} to ${endDate}`);
          sections.push(formatMetrics(dailyRows[0]!.total));
        }

        // Ad groups
        sections.push(`\n=== AD GROUPS (${adGroups.length}) ===`);
        for (const ag of adGroups) {
          sections.push(`• ${ag.name} (ID: ${ag.id}) — ${ag.displayStatus} — Default Bid: ${formatMoney(ag.defaultBidAmount)}`);
        }

        // Top keywords
        sections.push(`\n=== TOP ${keywords.length} KEYWORDS BY SPEND ===`);
        for (const row of keywords) {
          const m = row.metadata;
          sections.push(
            `• "${m.keyword}" (${m.matchType}) — Bid: ${formatMoney(m.bidAmount)} — Spend: ${formatMoney(row.total.localSpend)} — Installs: ${row.total.totalInstalls} — CPA: ${formatMoney(row.total.avgCPA)}`
          );
        }

        // Top search terms
        sections.push(`\n=== TOP ${searchTerms.length} SEARCH TERMS BY SPEND ===`);
        for (const row of searchTerms) {
          const m = row.metadata;
          sections.push(
            `• "${m.searchTermText ?? "(unknown)"}" (matched "${m.keyword}" ${m.matchType}) — Spend: ${formatMoney(row.total.localSpend)} — Installs: ${row.total.totalInstalls} — CPA: ${formatMoney(row.total.avgCPA)}`
          );
        }

        // Daily trends
        const granularity = dailyRows.length > 0 ? dailyRows[0]!.granularity : null;
        if (granularity && Array.isArray(granularity)) {
          sections.push("\n=== DAILY TRENDS ===");
          for (const day of granularity) {
            sections.push(
              `${day.date}: Spend=${formatMoney(day.localSpend)} Impressions=${day.impressions ?? 0} Taps=${day.taps ?? 0} Installs=${day.totalInstalls ?? 0}`
            );
          }
        }

        return {
          content: [
            { type: "text", text: sections.join("\n") },
            {
              type: "text",
              text: JSON.stringify(
                { campaign, adGroups, topKeywords: keywords, topSearchTerms: searchTerms, dailyTrends: dailyRows[0]?.granularity },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        return handleToolError(err);
      }
    }
  );

  server.registerTool(
    "get_budget_analysis",
    {
      title: "Budget Utilization Analysis",
      description: "Analyze budget utilization and efficiency across ALL campaigns. Shows spend vs budget, daily run rate, days until budget exhaustion, and cost per install. Use to identify under-spending campaigns (increase bids/keywords) and over-spending campaigns (reduce bids/budgets).",
      inputSchema: {
        startDate: z.string().describe("Start date (YYYY-MM-DD)"),
        endDate: z.string().describe("End date (YYYY-MM-DD)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ startDate, endDate }) => {
      try {
        validateDate(startDate, "startDate");
        validateDate(endDate, "endDate");

        // Get campaigns and their reports in parallel
        const [campaignsResp, reportResp] = await Promise.all([
          client.get<ApiListResponse<Campaign>>("/campaigns", { limit: "200" }),
          client.post<ReportResponse<{ campaignId: number; campaignName: string }>>(
            "/reports/campaigns",
            {
              startTime: startDate,
              endTime: endDate,
              selector: buildSelector({ limit: 200, sortBy: "localSpend", sortOrder: "DESCENDING" }),
              returnRowTotals: true,
              returnGrandTotals: true,
            } satisfies ReportingRequest
          ),
        ]);

        const campaigns = campaignsResp.data;
        const rows = reportResp.data.reportingDataResponse.row;

        const dayCount = Math.max(1, Math.ceil(
          (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
        ));

        const analysis = campaigns.map((campaign) => {
          const reportRow = rows.find((r) => r.metadata.campaignId === campaign.id);
          const totalSpend = reportRow?.total?.localSpend?.amount ? parseFloat(reportRow.total.localSpend.amount) : 0;
          const dailyRate = totalSpend / dayCount;
          const dailyBudget = campaign.dailyBudgetAmount ? parseFloat(campaign.dailyBudgetAmount.amount) : 0;
          const totalBudget = campaign.budgetAmount ? parseFloat(campaign.budgetAmount.amount) : 0;
          const budgetUtilization = dailyBudget > 0 ? (dailyRate / dailyBudget) * 100 : 0;
          const remainingBudget = totalBudget - totalSpend;
          const daysUntilExhaustion = dailyRate > 0 ? Math.floor(remainingBudget / dailyRate) : Infinity;

          return {
            campaign: campaign.name,
            campaignId: campaign.id,
            status: campaign.displayStatus,
            totalBudget: formatMoney(campaign.budgetAmount),
            dailyBudget: formatMoney(campaign.dailyBudgetAmount),
            totalSpend: totalSpend.toFixed(2),
            dailyRate: dailyRate.toFixed(2),
            budgetUtilization: `${budgetUtilization.toFixed(1)}%`,
            remainingBudget: remainingBudget.toFixed(2),
            daysUntilExhaustion: daysUntilExhaustion === Infinity ? "N/A" : String(daysUntilExhaustion),
            installs: reportRow?.total.totalInstalls ?? 0,
            cpa: reportRow ? formatMoney(reportRow.total.avgCPA) : "N/A",
          };
        });

        const lines = analysis.map((a) =>
          [
            `Campaign: ${a.campaign} (ID: ${a.campaignId}) — ${a.status}`,
            `  Budget: ${a.totalBudget} (Daily: ${a.dailyBudget})`,
            `  Spend: ${a.totalSpend} over ${dayCount} days (${a.dailyRate}/day)`,
            `  Utilization: ${a.budgetUtilization} of daily budget`,
            `  Remaining: ${a.remainingBudget} (~${a.daysUntilExhaustion} days at current rate)`,
            `  Installs: ${a.installs} | CPA: ${a.cpa}`,
          ].join("\n")
        );

        const text = [
          `Budget Analysis (${startDate} to ${endDate}):`,
          "",
          ...lines,
        ].join("\n\n");

        return {
          content: [
            { type: "text", text },
            { type: "text", text: JSON.stringify(analysis, null, 2) },
          ],
        };
      } catch (err) {
        return handleToolError(err);
      }
    }
  );
}
