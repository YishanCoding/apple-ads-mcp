import { z } from "zod";
import { buildSelector } from "../utils/selectors.js";
import { formatCreativeSummary } from "../utils/formatters.js";
import { handleToolError } from "../utils/error-handler.js";
export function registerCreativeTools(server, client) {
    server.registerTool("list_creatives", {
        title: "List / Find Creatives",
        description: "List or search creatives in the account. Creatives link product pages to ads — you need a creative before you can create_ad. Filter by adamId to find creatives for a specific app, or use conditions for advanced filtering.",
        inputSchema: {
            limit: z.number().optional().describe("Max results (default 50)"),
            offset: z.number().optional().describe("Pagination offset"),
            adamId: z.number().optional().describe("Filter by app Adam ID"),
            sortBy: z.string().optional().describe("Field to sort by (e.g., 'id', 'name', 'state')"),
            sortOrder: z.enum(["ASCENDING", "DESCENDING"]).optional(),
            conditions: z.array(z.object({
                field: z.string(),
                operator: z.enum(["EQUALS", "GREATER_THAN", "LESS_THAN", "IN", "LIKE", "STARTSWITH", "CONTAINS", "NOT_EQUALS"]),
                values: z.array(z.string()),
            })).optional().describe("Filter conditions"),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ limit, offset, adamId, sortBy, sortOrder, conditions }) => {
        try {
            let resp;
            if (conditions?.length || sortBy) {
                const selector = buildSelector({ limit, offset, sortBy, sortOrder, conditions });
                resp = await client.post("/creatives/find", selector);
            }
            else {
                const params = {
                    limit: String(limit ?? 50),
                    offset: String(offset ?? 0),
                };
                if (adamId)
                    params.adamId = String(adamId);
                resp = await client.get("/creatives", params);
            }
            const summaries = resp.data.map(formatCreativeSummary);
            const text = [
                `Found ${resp.data.length} creative(s):`,
                "",
                ...summaries.map((s, i) => `--- Creative ${i + 1} ---\n${s}`),
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
    server.registerTool("create_creative", {
        title: "Create Creative",
        description: `Create a new creative for use in ads. Creatives are based on App Store product pages. Use list_product_pages to find available product pages for the app, then provide the productPageId.

After creation, use create_ad to attach the creative to an ad group. Each ad group can have multiple ads with different creatives for A/B testing.`,
        inputSchema: {
            adamId: z.number().describe("App Adam ID"),
            name: z.string().describe("Creative name"),
            productPageId: z.string().optional().describe("Product page ID (use list_product_pages to find)"),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    }, async ({ adamId, name, productPageId }) => {
        try {
            const body = { adamId, name, type: "CUSTOM_PRODUCT_PAGE" };
            if (productPageId)
                body.productPageId = productPageId;
            const resp = await client.post("/creatives", body);
            return {
                content: [
                    { type: "text", text: `Created creative "${resp.data.name}" (ID: ${resp.data.id}). Use create_ad to attach it to an ad group.` },
                    { type: "text", text: JSON.stringify(resp.data, null, 2) },
                ],
            };
        }
        catch (err) {
            return handleToolError(err);
        }
    });
    server.registerTool("get_creative", {
        title: "Get Creative Details",
        description: "Get full details of a specific creative including its associated app, type, state, and timestamps.",
        inputSchema: {
            creativeId: z.number().describe("The creative ID"),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ creativeId }) => {
        try {
            const resp = await client.get(`/creatives/${creativeId}`);
            const summary = formatCreativeSummary(resp.data);
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
    server.registerTool("get_product_page_by_id", {
        title: "Get Product Page",
        description: "Get details of a specific product page by ID. Product pages are App Store page variations used to create custom creatives. Set includeLocales=true to also fetch locale-specific details (names, descriptions per language).",
        inputSchema: {
            adamId: z.number().describe("App Adam ID"),
            productPageId: z.string().describe("The product page ID"),
            includeLocales: z.boolean().optional().describe("Also fetch locale details (names, descriptions per language)"),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ adamId, productPageId, includeLocales }) => {
        try {
            const resp = await client.get(`/apps/${adamId}/product-pages/${productPageId}`);
            const pp = resp.data;
            const content = [
                { type: "text", text: `Product Page: ${pp.name} (ID: ${pp.id})${pp.isDefault ? " [DEFAULT]" : ""}\nState: ${pp.state}` },
                { type: "text", text: JSON.stringify(resp.data, null, 2) },
            ];
            if (includeLocales) {
                const locales = await client.get(`/apps/${adamId}/product-pages/${productPageId}/locale-details`);
                content.push({ type: "text", text: `\n${locales.data.length} locale(s):` }, { type: "text", text: JSON.stringify(locales.data, null, 2) });
            }
            return { content };
        }
        catch (err) {
            return handleToolError(err);
        }
    });
    server.registerTool("get_product_page_locales", {
        title: "Get Product Page Locales",
        description: "Fetch localized metadata for a product page by Adam ID and product page ID. Filter by device class or language code, and set expand=true to include locale-specific screenshots and app preview assets when Apple returns them.",
        inputSchema: {
            adamId: z.number().describe("App Adam ID"),
            productPageId: z.string().describe("The product page ID"),
            deviceClasses: z.array(z.enum(["IPAD", "IPHONE"])).optional().describe("Filter by device classes, e.g. ['IPHONE']"),
            expand: z.boolean().optional().describe("Include expanded locale asset metadata"),
            languageCodes: z.array(z.string()).optional().describe("Filter by ISO 639-1 language codes, e.g. ['en-US', 'zh-Hans']"),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ adamId, productPageId, deviceClasses, expand, languageCodes }) => {
        try {
            const params = {};
            if (deviceClasses?.length)
                params.deviceClasses = deviceClasses.join(",");
            if (expand)
                params.expand = "true";
            if (languageCodes?.length)
                params.languageCodes = languageCodes.join(",");
            const resp = await client.get(`/apps/${adamId}/product-pages/${productPageId}/locale-details`, params);
            const data = resp.data;
            const count = Array.isArray(data) ? data.length : data ? 1 : 0;
            return {
                content: [
                    { type: "text", text: `Found ${count} locale detail record(s) for product page ${productPageId}.` },
                    { type: "text", text: JSON.stringify(data, null, 2) },
                ],
            };
        }
        catch (err) {
            return handleToolError(err);
        }
    });
    server.registerTool("list_product_pages", {
        title: "List Product Pages",
        description: "List all product pages for an app. Product pages are App Store page variations that can be used as creatives for custom product page ads. Shows which page is the default and each page's state (VISIBLE, etc.).",
        inputSchema: {
            adamId: z.number().describe("App Adam ID"),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ adamId }) => {
        try {
            const resp = await client.get(`/apps/${adamId}/product-pages`);
            const text = resp.data
                .map((pp) => `${pp.name} (ID: ${pp.id})${pp.isDefault ? " [DEFAULT]" : ""} — State: ${pp.state}`)
                .join("\n");
            return {
                content: [
                    { type: "text", text: `Found ${resp.data.length} product page(s) for app ${adamId}:\n${text}` },
                    { type: "text", text: JSON.stringify(resp.data, null, 2) },
                ],
            };
        }
        catch (err) {
            return handleToolError(err);
        }
    });
    server.registerTool("get_supported_countries_regions", {
        title: "Get Supported Countries or Regions",
        description: "Fetch supported product-page countries or regions and their supported/default locales. Optionally pass country/region codes such as US, GB, CA.",
        inputSchema: {
            countriesOrRegions: z.array(z.string()).optional().describe("Country/region codes to filter by, e.g. ['US', 'GB']"),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async ({ countriesOrRegions }) => {
        try {
            const params = countriesOrRegions?.length
                ? { countriesOrRegions: countriesOrRegions.join(",") }
                : undefined;
            const resp = await client.get("/countries-or-regions", params);
            const data = resp.data ?? resp;
            const records = Array.isArray(data) ? data : data ? [data] : [];
            const text = records
                .map((record) => {
                const code = record.countryOrRegion ?? "unknown";
                const locales = record.supportedLanguages ?? record.supportedLocales ?? [];
                return `${code}: ${locales.map((locale) => locale.languageCode ?? locale.language).filter(Boolean).join(", ")}`;
            })
                .join("\n");
            return {
                content: [
                    { type: "text", text: `Found ${records.length} supported country/region record(s):\n${text}` },
                    { type: "text", text: JSON.stringify(data, null, 2) },
                ],
            };
        }
        catch (err) {
            return handleToolError(err);
        }
    });
    server.registerTool("get_app_preview_device_sizes", {
        title: "Get App Preview Device Sizes",
        description: "Fetch Apple's supported app preview device-size mappings for creative assets.",
        inputSchema: {},
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async () => {
        try {
            const resp = await client.get("/creativeappmappings/devices");
            const data = resp.data ?? resp;
            const entries = Object.entries(data);
            return {
                content: [
                    { type: "text", text: `Found ${entries.length} app preview device size mapping(s).` },
                    { type: "text", text: JSON.stringify(data, null, 2) },
                ],
            };
        }
        catch (err) {
            return handleToolError(err);
        }
    });
}
//# sourceMappingURL=creatives.js.map
