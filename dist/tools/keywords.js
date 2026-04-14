import { z } from "zod";
import { buildSelector } from "../utils/selectors.js";
import { formatMetrics, formatMoney } from "../utils/formatters.js";
import { handleToolError } from "../utils/error-handler.js";
import { validateDate } from "../utils/validators.js";
export function registerKeywordTools(server, client) {
    server.registerTool("get_keyword_report", {
        title: "Keyword Performance Report",
        description: "Get keyword-level performance metrics: impressions, taps, installs, spend, CPA, CPT, and conversion rate per keyword. Essential for bid optimization — identify high-CPA keywords to lower bids or pause, and high-converting keywords to increase bids. Also includes impression share data in the raw JSON (insights.impressionShare). Use get_search_term_report for the actual user queries that triggered each keyword.",
        inputSchema: {
            campaignId: z.number().describe("The campaign ID"),
            adGroupId: z.number().optional().describe("Filter to a specific ad group"),
            startDate: z.string().describe("Start date (YYYY-MM-DD)"),
            endDate: z.string().describe("End date (YYYY-MM-DD)"),
            sortBy: z.string().optional().describe("Sort field: 'localSpend' (default), 'impressions', 'installs', 'avgCPA', 'taps'"),
            limit: z.number().optional().describe("Max rows (default 100)"),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ campaignId, adGroupId, startDate, endDate, sortBy, limit }) => {
        try {
            validateDate(startDate, "startDate");
            validateDate(endDate, "endDate");
            const reportReq = {
                startTime: startDate,
                endTime: endDate,
                selector: buildSelector({
                    limit: limit ?? 100,
                    sortBy: sortBy ?? "localSpend",
                    sortOrder: "DESCENDING",
                }),
                returnRowTotals: true,
            };
            const path = adGroupId
                ? `/reports/campaigns/${campaignId}/adgroups/${adGroupId}/keywords`
                : `/reports/campaigns/${campaignId}/keywords`;
            const resp = await client.post(path, reportReq);
            const rows = resp.data.reportingDataResponse.row;
            if (rows.length === 0) {
                return { content: [{ type: "text", text: "No keyword data found." }] };
            }
            const summaries = rows.map((row) => {
                return [
                    `Keyword: "${row.metadata.keyword}" (${row.metadata.matchType}, ID: ${row.metadata.keywordId})`,
                    `Bid: ${formatMoney(row.metadata.bidAmount)}`,
                    formatMetrics(row.total),
                ].join("\n");
            });
            const text = [
                `Keyword Report (${startDate} to ${endDate}):`,
                `Showing ${rows.length} keywords sorted by ${sortBy ?? "localSpend"}`,
                "",
                ...summaries.map((s, i) => `--- Keyword ${i + 1} ---\n${s}`),
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
    server.registerTool("list_targeting_keywords", {
        title: "List / Find Targeting Keywords",
        description: "List or search targeting keywords in a campaign. Provide adGroupId for keywords in a specific ad group, or omit to search across all ad groups. Returns keyword text, match type, bid, and status. Use get_keyword_report for performance metrics instead.",
        inputSchema: {
            campaignId: z.number().describe("The campaign ID"),
            adGroupId: z.number().optional().describe("Ad group ID (omit to search across all ad groups)"),
            limit: z.number().optional().describe("Max results (default 200)"),
            offset: z.number().optional().describe("Pagination offset"),
            sortBy: z.string().optional().describe("Field to sort by (e.g., 'id', 'text', 'status')"),
            sortOrder: z.enum(["ASCENDING", "DESCENDING"]).optional(),
            conditions: z.array(z.object({
                field: z.string(),
                operator: z.enum(["EQUALS", "GREATER_THAN", "LESS_THAN", "IN", "LIKE", "STARTSWITH", "CONTAINS", "NOT_EQUALS"]),
                values: z.array(z.string()),
            })).optional().describe("Filter conditions (e.g., [{field:'status', operator:'EQUALS', values:['ACTIVE']}])"),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ campaignId, adGroupId, limit, offset, sortBy, sortOrder, conditions }) => {
        try {
            let resp;
            if (conditions?.length || sortBy || !adGroupId) {
                const selector = buildSelector({ limit, offset, sortBy, sortOrder, conditions });
                resp = await client.post(`/campaigns/${campaignId}/adgroups/targetingkeywords/find`, selector);
            }
            else {
                resp = await client.get(`/campaigns/${campaignId}/adgroups/${adGroupId}/targetingkeywords`, { limit: String(limit ?? 200) });
            }
            const text = resp.data
                .map((kw) => `"${kw.text}" (${kw.matchType}, ID: ${kw.id}) — Bid: ${formatMoney(kw.bidAmount)} — Status: ${kw.status}`)
                .join("\n");
            return {
                content: [
                    { type: "text", text: `${resp.data.length} targeting keywords:\n${text}` },
                    { type: "text", text: JSON.stringify(resp.data, null, 2) },
                ],
            };
        }
        catch (err) {
            return handleToolError(err);
        }
    });
    server.registerTool("list_negative_keywords", {
        title: "List / Find Negative Keywords",
        description: "List negative keywords at campaign or ad group level. Negative keywords prevent your ads from showing for specific search terms. Use get_search_term_report to identify wasteful terms, then add_negative_keywords to block them. NOTE: The Apple Search Ads API does not support filter conditions on negative keyword endpoints — use sorting and client-side filtering instead.",
        inputSchema: {
            campaignId: z.number().describe("The campaign ID"),
            adGroupId: z.number().optional().describe("Ad group ID (omit for campaign-level negatives)"),
            limit: z.number().optional().describe("Max results (default 1000)"),
            offset: z.number().optional().describe("Pagination offset"),
            sortBy: z.string().optional().describe("Field to sort by"),
            sortOrder: z.enum(["ASCENDING", "DESCENDING"]).optional(),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ campaignId, adGroupId, limit, offset, sortBy, sortOrder }) => {
        try {
            let resp;
            if (sortBy) {
                const selector = buildSelector({ limit, offset, sortBy, sortOrder });
                if (adGroupId) {
                    resp = await client.post(`/campaigns/${campaignId}/adgroups/negativekeywords/find`, selector);
                }
                else {
                    resp = await client.post(`/campaigns/${campaignId}/negativekeywords/find`, selector);
                }
            }
            else {
                const path = adGroupId
                    ? `/campaigns/${campaignId}/adgroups/${adGroupId}/negativekeywords`
                    : `/campaigns/${campaignId}/negativekeywords`;
                resp = await client.get(path, { limit: String(limit ?? 1000) });
            }
            const text = resp.data
                .map((kw) => {
                const parts = [`"${kw.text}" (${kw.matchType}, ID: ${kw.id})`];
                if (kw.adGroupId)
                    parts.push(`Ad Group: ${kw.adGroupId}`);
                parts.push(`Status: ${kw.status}`);
                return parts.join(" — ");
            })
                .join("\n");
            const level = adGroupId ? `ad group ${adGroupId}` : `campaign ${campaignId}`;
            return {
                content: [
                    { type: "text", text: `${resp.data.length} negative keywords at ${level} level:\n${text}` },
                    { type: "text", text: JSON.stringify(resp.data, null, 2) },
                ],
            };
        }
        catch (err) {
            return handleToolError(err);
        }
    });
    server.registerTool("delete_targeting_keywords", {
        title: "Delete Targeting Keywords",
        description: "Permanently delete targeting keywords from an ad group in bulk. This CANNOT be undone — the keyword and its historical association are removed. Consider pausing instead (update_targeting_keywords with status=PAUSED) to preserve bid history.",
        inputSchema: {
            campaignId: z.number().describe("The campaign ID"),
            adGroupId: z.number().describe("The ad group ID"),
            keywordIds: z.array(z.number()).describe("Array of keyword IDs to delete"),
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    }, async ({ campaignId, adGroupId, keywordIds }) => {
        try {
            await client.post(`/campaigns/${campaignId}/adgroups/${adGroupId}/targetingkeywords/delete/bulk`, keywordIds);
            return {
                content: [{ type: "text", text: `Deleted ${keywordIds.length} targeting keyword(s) from ad group ${adGroupId}.` }],
            };
        }
        catch (err) {
            return handleToolError(err);
        }
    });
    server.registerTool("delete_negative_keywords", {
        title: "Delete Negative Keywords",
        description: "Permanently delete negative keywords in bulk. After deletion, ads may start showing for previously blocked search terms. Only delete if you're sure those terms are no longer wasteful.",
        inputSchema: {
            campaignId: z.number().describe("The campaign ID"),
            adGroupId: z.number().optional().describe("Ad group ID (omit for campaign-level)"),
            keywordIds: z.array(z.number()).describe("Array of negative keyword IDs to delete"),
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    }, async ({ campaignId, adGroupId, keywordIds }) => {
        try {
            const path = adGroupId
                ? `/campaigns/${campaignId}/adgroups/${adGroupId}/negativekeywords/delete/bulk`
                : `/campaigns/${campaignId}/negativekeywords/delete/bulk`;
            await client.post(path, keywordIds);
            const level = adGroupId ? `ad group ${adGroupId}` : `campaign ${campaignId}`;
            return {
                content: [{ type: "text", text: `Deleted ${keywordIds.length} negative keyword(s) at ${level} level.` }],
            };
        }
        catch (err) {
            return handleToolError(err);
        }
    });
    server.registerTool("update_targeting_keywords", {
        title: "Update Targeting Keywords (Bulk)",
        description: "Update targeting keywords in bulk — change status (ACTIVE/PAUSED) and/or bid amounts. Use to pause underperforming keywords or adjust bids based on get_keyword_report data. Pass an array of 1 for single-keyword updates. Bid changes take effect immediately and affect future auctions.",
        inputSchema: {
            campaignId: z.number().describe("The campaign ID"),
            adGroupId: z.number().describe("The ad group ID"),
            keywords: z
                .array(z.object({
                keywordId: z.number().describe("The keyword ID to update"),
                status: z.enum(["ACTIVE", "PAUSED"]).optional().describe("New status"),
                bidAmount: z.string().optional().describe("New bid amount (e.g., '1.50')"),
            }))
                .describe("Keywords to update"),
            currency: z.string().optional().describe("Currency code (default USD)"),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ campaignId, adGroupId, keywords, currency }) => {
        try {
            const cur = currency ?? "USD";
            const body = keywords.map((kw) => {
                const update = { id: kw.keywordId };
                if (kw.status)
                    update.status = kw.status;
                if (kw.bidAmount)
                    update.bidAmount = { amount: kw.bidAmount, currency: cur };
                return update;
            });
            const resp = await client.put(`/campaigns/${campaignId}/adgroups/${adGroupId}/targetingkeywords/bulk`, body);
            const summaries = resp.data.map((kw) => `"${kw.text}" — Status: ${kw.status}, Bid: ${formatMoney(kw.bidAmount)}`);
            return {
                content: [
                    { type: "text", text: `Updated ${resp.data.length} keyword(s):\n${summaries.join("\n")}` },
                    { type: "text", text: JSON.stringify(resp.data, null, 2) },
                ],
            };
        }
        catch (err) {
            return handleToolError(err);
        }
    });
    server.registerTool("add_targeting_keywords", {
        title: "Add Targeting Keywords",
        description: `Add new targeting keywords to an ad group. Keywords determine which App Store search queries trigger your ads.

Match types: EXACT matches the exact query only (higher relevance, lower volume). BROAD matches related queries and synonyms (higher volume, may need negatives). Start with EXACT for proven terms and BROAD for discovery, then use get_search_term_report to refine.

⚠️ MAX_CONVERSIONS Anchor Ad Group: When adding keywords to the non-automated (anchor) ad group of a MAX_CONVERSIONS campaign, set bidAmount to "0" — Apple's algorithm controls bidding automatically. Passing a real bid amount will be silently ignored or rejected.`,
        inputSchema: {
            campaignId: z.number().describe("The campaign ID"),
            adGroupId: z.number().describe("The ad group ID"),
            keywords: z
                .array(z.object({
                text: z.string().describe("The keyword text (e.g., 'photo editor')"),
                matchType: z.enum(["BROAD", "EXACT"]).describe("EXACT for precise matching, BROAD for synonyms/related"),
                bidAmount: z.string().describe("Max CPC bid (e.g., '1.00')"),
            }))
                .describe("Keywords to add"),
            currency: z.string().optional().describe("Currency code (default 'USD')"),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    }, async ({ campaignId, adGroupId, keywords, currency }) => {
        try {
            const cur = currency ?? "USD";
            const body = keywords.map((kw) => ({
                text: kw.text,
                matchType: kw.matchType,
                bidAmount: { amount: kw.bidAmount, currency: cur },
            }));
            const resp = await client.post(`/campaigns/${campaignId}/adgroups/${adGroupId}/targetingkeywords/bulk`, body);
            return {
                content: [
                    { type: "text", text: `Added ${resp.data.length} keywords to ad group ${adGroupId}.` },
                    { type: "text", text: JSON.stringify(resp.data, null, 2) },
                ],
            };
        }
        catch (err) {
            return handleToolError(err);
        }
    });
    server.registerTool("get_targeting_keyword", {
        title: "Get Targeting Keyword",
        description: "Get details of a specific targeting keyword: text, match type, bid amount, and status. Use get_keyword_report for performance metrics.",
        inputSchema: {
            campaignId: z.number().describe("The campaign ID"),
            adGroupId: z.number().describe("The ad group ID"),
            keywordId: z.number().describe("The keyword ID"),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ campaignId, adGroupId, keywordId }) => {
        try {
            const resp = await client.get(`/campaigns/${campaignId}/adgroups/${adGroupId}/targetingkeywords/${keywordId}`);
            const kw = resp.data;
            return {
                content: [
                    { type: "text", text: `Keyword: "${kw.text}" (${kw.matchType}, ID: ${kw.id})\nBid: ${formatMoney(kw.bidAmount)}\nStatus: ${kw.status}` },
                    { type: "text", text: JSON.stringify(resp.data, null, 2) },
                ],
            };
        }
        catch (err) {
            return handleToolError(err);
        }
    });
    server.registerTool("get_negative_keyword", {
        title: "Get Negative Keyword",
        description: "Get details of a specific negative keyword by ID at the campaign or ad group level.",
        inputSchema: {
            campaignId: z.number().describe("The campaign ID"),
            adGroupId: z.number().optional().describe("Ad group ID (omit for campaign-level negative keyword)"),
            keywordId: z.number().describe("The negative keyword ID"),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ campaignId, adGroupId, keywordId }) => {
        try {
            const path = adGroupId
                ? `/campaigns/${campaignId}/adgroups/${adGroupId}/negativekeywords/${keywordId}`
                : `/campaigns/${campaignId}/negativekeywords/${keywordId}`;
            const resp = await client.get(path);
            const kw = resp.data;
            const level = adGroupId ? `ad group ${adGroupId}` : `campaign ${campaignId}`;
            return {
                content: [
                    { type: "text", text: `Negative Keyword (${level}): "${kw.text}" (${kw.matchType}, ID: ${kw.id})\nStatus: ${kw.status}` },
                    { type: "text", text: JSON.stringify(resp.data, null, 2) },
                ],
            };
        }
        catch (err) {
            return handleToolError(err);
        }
    });
    server.registerTool("update_negative_keywords", {
        title: "Update Negative Keywords (Bulk)",
        description: "Update negative keywords in bulk at the campaign or ad group level. Change status (ACTIVE/PAUSED), match type, or text. Pausing a negative keyword allows the previously blocked search term to trigger ads again.",
        inputSchema: {
            campaignId: z.number().describe("The campaign ID"),
            adGroupId: z.number().optional().describe("Ad group ID (omit for campaign-level)"),
            keywords: z.array(z.object({
                keywordId: z.number().describe("The negative keyword ID to update"),
                status: z.enum(["ACTIVE", "PAUSED"]).optional().describe("New status"),
                matchType: z.enum(["BROAD", "EXACT"]).optional().describe("New match type"),
                text: z.string().optional().describe("New keyword text"),
            })).describe("Negative keywords to update"),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ campaignId, adGroupId, keywords }) => {
        try {
            const path = adGroupId
                ? `/campaigns/${campaignId}/adgroups/${adGroupId}/negativekeywords/bulk`
                : `/campaigns/${campaignId}/negativekeywords/bulk`;
            const body = keywords.map((kw) => {
                const update = { id: kw.keywordId };
                if (kw.status)
                    update.status = kw.status;
                if (kw.matchType)
                    update.matchType = kw.matchType;
                if (kw.text)
                    update.text = kw.text;
                return update;
            });
            const resp = await client.put(path, body);
            const level = adGroupId ? `ad group ${adGroupId}` : `campaign ${campaignId}`;
            const summaries = resp.data.map((kw) => `"${kw.text}" (${kw.matchType}) — Status: ${kw.status}`);
            return {
                content: [
                    { type: "text", text: `Updated ${resp.data.length} negative keyword(s) at ${level} level:\n${summaries.join("\n")}` },
                    { type: "text", text: JSON.stringify(resp.data, null, 2) },
                ],
            };
        }
        catch (err) {
            return handleToolError(err);
        }
    });
    server.registerTool("add_negative_keywords", {
        title: "Add Negative Keywords",
        description: "Add negative keywords to block wasteful search terms from triggering your ads. Campaign-level negatives block across all ad groups; ad-group-level negatives only block within that ad group. Use get_search_term_report to identify high-spend/low-conversion terms to block.",
        inputSchema: {
            campaignId: z.number().describe("The campaign ID"),
            adGroupId: z.number().optional().describe("Ad group ID (omit for campaign-level — blocks across ALL ad groups)"),
            keywords: z
                .array(z.object({
                text: z.string().describe("The keyword text to block"),
                matchType: z.enum(["BROAD", "EXACT"]).describe("EXACT blocks only this exact term, BROAD blocks variations too"),
            }))
                .describe("Negative keywords to add"),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    }, async ({ campaignId, adGroupId, keywords }) => {
        try {
            const path = adGroupId
                ? `/campaigns/${campaignId}/adgroups/${adGroupId}/negativekeywords/bulk`
                : `/campaigns/${campaignId}/negativekeywords/bulk`;
            const body = keywords;
            const resp = await client.post(path, body);
            const level = adGroupId ? `ad group ${adGroupId}` : `campaign ${campaignId}`;
            return {
                content: [
                    { type: "text", text: `Added ${resp.data.length} negative keywords at ${level} level.` },
                    { type: "text", text: JSON.stringify(resp.data, null, 2) },
                ],
            };
        }
        catch (err) {
            return handleToolError(err);
        }
    });
}
//# sourceMappingURL=keywords.js.map