import { z } from "zod";
import { buildSelector } from "../utils/selectors.js";
import { formatAdSummary, formatMetrics } from "../utils/formatters.js";
import { handleToolError } from "../utils/error-handler.js";
import { validateDate } from "../utils/validators.js";
export function registerAdTools(server, client) {
    server.registerTool("list_ads", {
        title: "List / Find Ads",
        description: "List or search ads. Provide campaignId + adGroupId for a direct listing, campaignId alone to search within a campaign, or omit both for org-level search. Supports filtering and sorting. Returns ad ID, name, creative, status, and rejection reasons if any.",
        inputSchema: {
            campaignId: z.number().optional().describe("Campaign ID (omit to search across all campaigns)"),
            adGroupId: z.number().optional().describe("Ad group ID (used with campaignId for direct listing)"),
            limit: z.number().optional().describe("Max results (default 50)"),
            offset: z.number().optional().describe("Pagination offset"),
            sortBy: z.string().optional().describe("Field to sort by (e.g., 'id', 'name', 'status')"),
            sortOrder: z.enum(["ASCENDING", "DESCENDING"]).optional(),
            conditions: z.array(z.object({
                field: z.string(),
                operator: z.enum(["EQUALS", "GREATER_THAN", "LESS_THAN", "IN", "LIKE", "STARTSWITH", "CONTAINS", "NOT_EQUALS"]),
                values: z.array(z.string()),
            })).optional().describe("Filter conditions"),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ campaignId, adGroupId, limit, offset, sortBy, sortOrder, conditions }) => {
        try {
            let resp;
            if (!campaignId) {
                const selector = buildSelector({ limit, offset, sortBy, sortOrder, conditions });
                resp = await client.post("/ads/find", selector);
            }
            else if (conditions?.length || sortBy || !adGroupId) {
                const selector = buildSelector({ limit, offset, sortBy, sortOrder, conditions });
                resp = await client.post(`/campaigns/${campaignId}/ads/find`, selector);
            }
            else {
                resp = await client.get(`/campaigns/${campaignId}/adgroups/${adGroupId}/ads`, { limit: String(limit ?? 50) });
            }
            const summaries = resp.data.map(formatAdSummary);
            const scope = !campaignId ? "all campaigns" : adGroupId ? `ad group ${adGroupId}` : `campaign ${campaignId}`;
            const text = [
                `Found ${resp.data.length} ad(s) in ${scope} (total: ${resp.pagination?.totalResults ?? resp.data.length}):`,
                "",
                ...summaries.map((s, i) => `--- Ad ${i + 1} ---\n${s}`),
            ].join("\n");
            return {
                content: [
                    { type: "text", text },
                    { type: "text", text: JSON.stringify(resp.data, null, 2) },
                ],
            };
        }
        catch (err) {
            return handleToolError(err);
        }
    });
    server.registerTool("create_ad", {
        title: "Create Ad",
        description: `Create a new ad within an ad group. Requires a creativeId — use list_creatives to find available creatives, or create_creative to make a new one from a product page.

Each ad group can have multiple ads with different creatives. Apple will automatically optimize delivery toward the best-performing creative. Defaults: status=ENABLED.`,
        inputSchema: {
            campaignId: z.number().describe("The campaign ID"),
            adGroupId: z.number().describe("The ad group ID"),
            name: z.string().optional().describe("Ad name (auto-generated if omitted)"),
            creativeId: z.number().describe("Creative ID (use list_creatives to find)"),
            status: z.enum(["ENABLED", "PAUSED"]).optional().describe("Initial status (default 'ENABLED')"),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    }, async ({ campaignId, adGroupId, name, creativeId, status }) => {
        try {
            const body = {
                creativeId,
                status: status ?? "ENABLED",
            };
            if (name)
                body.name = name;
            const resp = await client.post(`/campaigns/${campaignId}/adgroups/${adGroupId}/ads`, body);
            return {
                content: [
                    { type: "text", text: `Created ad "${resp.data.name}" (ID: ${resp.data.id}) in ad group ${adGroupId}` },
                    { type: "text", text: JSON.stringify(resp.data, null, 2) },
                ],
            };
        }
        catch (err) {
            return handleToolError(err);
        }
    });
    server.registerTool("update_ad", {
        title: "Update Ad",
        description: "Update an ad's name or status. Setting status to PAUSED stops delivery for this specific ad variation only; other ads in the same ad group continue serving.",
        inputSchema: {
            campaignId: z.number().describe("The campaign ID"),
            adGroupId: z.number().describe("The ad group ID"),
            adId: z.number().describe("The ad ID"),
            name: z.string().optional().describe("New ad name"),
            status: z.enum(["ENABLED", "PAUSED"]).optional().describe("New status"),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ campaignId, adGroupId, adId, name, status }) => {
        try {
            const body = {};
            if (name)
                body.name = name;
            if (status)
                body.status = status;
            if (Object.keys(body).length === 0) {
                return { content: [{ type: "text", text: "No changes specified." }] };
            }
            const resp = await client.put(`/campaigns/${campaignId}/adgroups/${adGroupId}/ads/${adId}`, body);
            return {
                content: [
                    { type: "text", text: `Updated ad "${resp.data.name}" (ID: ${resp.data.id})` },
                    { type: "text", text: JSON.stringify(resp.data, null, 2) },
                ],
            };
        }
        catch (err) {
            return handleToolError(err);
        }
    });
    server.registerTool("delete_ad", {
        title: "Delete Ad",
        description: "Permanently delete an ad. This action CANNOT be undone. The ad group must have at least one remaining ad, or it will stop serving. Consider pausing instead (update_ad with status=PAUSED).",
        inputSchema: {
            campaignId: z.number().describe("The campaign ID"),
            adGroupId: z.number().describe("The ad group ID"),
            adId: z.number().describe("The ad ID to delete"),
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    }, async ({ campaignId, adGroupId, adId }) => {
        try {
            await client.delete(`/campaigns/${campaignId}/adgroups/${adGroupId}/ads/${adId}`);
            return {
                content: [{ type: "text", text: `Deleted ad ${adId} from ad group ${adGroupId}.` }],
            };
        }
        catch (err) {
            return handleToolError(err);
        }
    });
    server.registerTool("get_ad", {
        title: "Get Ad Details",
        description: "Get full details of a specific ad including its creative association, serving status, and any rejection reasons.",
        inputSchema: {
            campaignId: z.number().describe("The campaign ID"),
            adGroupId: z.number().describe("The ad group ID"),
            adId: z.number().describe("The ad ID"),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ campaignId, adGroupId, adId }) => {
        try {
            const resp = await client.get(`/campaigns/${campaignId}/adgroups/${adGroupId}/ads/${adId}`);
            const summary = formatAdSummary(resp.data);
            return {
                content: [
                    { type: "text", text: summary },
                    { type: "text", text: JSON.stringify(resp.data, null, 2) },
                ],
            };
        }
        catch (err) {
            return handleToolError(err);
        }
    });
    server.registerTool("find_ad_rejection_reasons", {
        title: "Ad Rejection Reasons",
        description: "Find ad rejection reasons across your account, or get a specific rejection reason by ID. Use this when ads are not serving to understand why Apple rejected them and what to fix.",
        inputSchema: {
            productPageReasonId: z.number().optional().describe("Get a specific rejection reason by ID"),
            limit: z.number().optional().describe("Max results (default 1000)"),
            offset: z.number().optional().describe("Pagination offset"),
            sortBy: z.string().optional().describe("Field to sort by"),
            sortOrder: z.enum(["ASCENDING", "DESCENDING"]).optional(),
            conditions: z.array(z.object({
                field: z.string(),
                operator: z.enum(["EQUALS", "GREATER_THAN", "LESS_THAN", "IN", "LIKE", "STARTSWITH", "CONTAINS", "NOT_EQUALS"]),
                values: z.array(z.string()),
            })).optional().describe("Filter conditions"),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ productPageReasonId, limit, offset, sortBy, sortOrder, conditions }) => {
        try {
            if (productPageReasonId) {
                const resp = await client.get(`/product-page-reasons/${productPageReasonId}`);
                return {
                    content: [
                        { type: "text", text: `Ad rejection reason ${productPageReasonId}:` },
                        { type: "text", text: JSON.stringify(resp.data, null, 2) },
                    ],
                };
            }
            const selector = buildSelector({ limit, offset, sortBy, sortOrder, conditions });
            const resp = await client.post("/product-page-reasons/find", selector);
            return {
                content: [
                    { type: "text", text: `Found ${resp.data.length} ad rejection reason(s).` },
                    { type: "text", text: JSON.stringify(resp.data, null, 2) },
                ],
            };
        }
        catch (err) {
            return handleToolError(err);
        }
    });
    server.registerTool("get_ad_report", {
        title: "Ad Performance Report",
        description: "Get performance metrics per ad variation within a campaign. Compare creative performance to identify which ad variations drive the best CPA and conversion rates. Use this to decide which creatives to scale and which to pause.",
        inputSchema: {
            campaignId: z.number().describe("The campaign ID"),
            startDate: z.string().describe("Start date (YYYY-MM-DD)"),
            endDate: z.string().describe("End date (YYYY-MM-DD)"),
            granularity: z.enum(["HOURLY", "DAILY", "WEEKLY", "MONTHLY"]).optional().describe("Time granularity (default DAILY)"),
            limit: z.number().optional().describe("Max rows (default 100)"),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ campaignId, startDate, endDate, granularity, limit }) => {
        try {
            validateDate(startDate, "startDate");
            validateDate(endDate, "endDate");
            const reportReq = {
                startTime: startDate,
                endTime: endDate,
                granularity: granularity ?? "DAILY",
                selector: buildSelector({ limit: limit ?? 100, sortBy: "localSpend", sortOrder: "DESCENDING" }),
                returnRowTotals: true,
            };
            const resp = await client.post(`/reports/campaigns/${campaignId}/ads`, reportReq);
            const rows = resp.data.reportingDataResponse.row;
            if (rows.length === 0) {
                return { content: [{ type: "text", text: "No ad data found for the specified date range." }] };
            }
            const summaries = rows.map((row) => {
                return [
                    `Ad: ${row.metadata.adName} (ID: ${row.metadata.adId})`,
                    formatMetrics(row.total),
                ].join("\n");
            });
            const text = [
                `Ad Report for Campaign ${campaignId} (${startDate} to ${endDate}):`,
                "",
                ...summaries.map((s, i) => `--- Ad ${i + 1} ---\n${s}`),
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
//# sourceMappingURL=ads.js.map