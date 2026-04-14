import { z } from "zod";
import { buildSelector } from "../utils/selectors.js";
import { formatMetrics } from "../utils/formatters.js";
import { handleToolError } from "../utils/error-handler.js";
import { validateDate } from "../utils/validators.js";
export function registerGeoTools(server, client) {
    server.registerTool("get_geo_performance", {
        title: "Geo Performance Report",
        description: "Get performance metrics broken down by country or region for a campaign. Shows impressions, taps, installs, spend, CPA per market. Use to identify which countries deliver the best ROI and where to increase/decrease investment or adjust geo targeting.",
        inputSchema: {
            campaignId: z.number().describe("The campaign ID"),
            startDate: z.string().describe("Start date (YYYY-MM-DD)"),
            endDate: z.string().describe("End date (YYYY-MM-DD)"),
            granularity: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).optional(),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ campaignId, startDate, endDate, granularity }) => {
        try {
            validateDate(startDate, "startDate");
            validateDate(endDate, "endDate");
            const reportReq = {
                startTime: startDate,
                endTime: endDate,
                granularity: granularity ?? "DAILY",
                groupBy: ["countryOrRegion"],
                selector: buildSelector({
                    limit: 100,
                    sortBy: "localSpend",
                    sortOrder: "DESCENDING",
                    conditions: [{ field: "campaignId", operator: "EQUALS", values: [String(campaignId)] }],
                }),
                returnRowTotals: true,
            };
            const resp = await client.post("/reports/campaigns", reportReq);
            const rows = resp.data.reportingDataResponse.row;
            if (rows.length === 0) {
                return { content: [{ type: "text", text: "No geo data found for the specified date range." }] };
            }
            const summaries = rows.map((row) => {
                return [
                    `Country/Region: ${row.metadata.countryOrRegion}`,
                    formatMetrics(row.total),
                ].join("\n");
            });
            const text = [
                `Geo Performance for Campaign ${campaignId} (${startDate} to ${endDate}):`,
                "",
                ...summaries.map((s, i) => `--- Region ${i + 1} ---\n${s}`),
            ].join("\n");
            return {
                content: [
                    { type: "text", text },
                    { type: "text", text: JSON.stringify(rows, null, 2) },
                ],
            };
        }
        catch (err) {
            return handleToolError(err);
        }
    });
}
//# sourceMappingURL=geo.js.map