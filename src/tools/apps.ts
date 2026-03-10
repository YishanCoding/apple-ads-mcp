import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppleAdsClient } from "../client/api-client.js";
import type { ApiListResponse, ApiResponse, AppInfo, AppEligibility, GeoLocation } from "../types/apple-ads.js";
import { buildSelector } from "../utils/selectors.js";
import { handleToolError } from "../utils/error-handler.js";

export function registerAppTools(server: McpServer, client: AppleAdsClient) {
  server.registerTool(
    "search_apps",
    {
      title: "Search Apps",
      description: "Search for apps eligible for Apple Search Ads campaigns by name or keyword. Returns app name, Adam ID (needed for create_campaign), and developer info. Set returnOwnedApps=true to only show apps you own.",
      inputSchema: {
        query: z.string().describe("Search query (app name or keyword)"),
        returnOwnedApps: z.boolean().optional().describe("Only return apps owned by this org (default false)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ query, returnOwnedApps }) => {
      try {
        const params: Record<string, string> = { query };
        if (returnOwnedApps) params.returnOwnedApps = "true";

        const resp = await client.get<ApiListResponse<AppInfo>>("/search/apps", params);

        const text = resp.data
          .map((app) => `${app.appName} (Adam ID: ${app.adamId}) — ${app.developerName}`)
          .join("\n");

        return {
          content: [
            { type: "text", text: `Found ${resp.data.length} app(s):\n${text}` },
            { type: "text", text: JSON.stringify(resp.data, null, 2) },
          ],
        };
      } catch (err) {
        return handleToolError(err);
      }
    }
  );

  server.registerTool(
    "get_app_eligibility",
    {
      title: "Check App Eligibility",
      description: "Check if an app is eligible for Apple Search Ads in specific countries and supply sources. Shows eligibility state, device class, and minimum age per country. Use before creating a campaign to verify the app can run ads in target markets.",
      inputSchema: {
        adamId: z.number().describe("The app Adam ID"),
        countriesOrRegions: z.array(z.string()).optional().describe("Filter by country/region codes (e.g., ['US', 'GB'])"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ adamId, countriesOrRegions }) => {
      try {
        const body: Record<string, unknown> = {
          pagination: { offset: 0, limit: 100 },
        };
        if (countriesOrRegions?.length) {
          body.conditions = [
            { field: "countryOrRegion", operator: "IN", values: countriesOrRegions },
          ];
        }

        const resp = await client.post<ApiListResponse<AppEligibility>>(
          `/apps/${adamId}/eligibilities/find`,
          body
        );

        if (resp.data.length === 0) {
          return { content: [{ type: "text", text: `No eligibility data found for Adam ID ${adamId}.` }] };
        }

        const lines = resp.data.map((item) => {
          return [
            `Adam ID: ${item.adamId}`,
            `Country/Region: ${item.countryOrRegion}`,
            `Supply Source: ${item.supplySource}`,
            `Device Class: ${item.deviceClass}`,
            `State: ${item.state}`,
            `Min Age: ${item.minAge}`,
          ].join("\n");
        });

        return {
          content: [
            { type: "text", text: lines.join("\n---\n") },
            { type: "text", text: JSON.stringify(resp.data, null, 2) },
          ],
        };
      } catch (err) {
        return handleToolError(err);
      }
    }
  );

  server.registerTool(
    "get_app_details",
    {
      title: "Get App Details",
      description: "Get detailed information about an app by Adam ID including app name, category, and store metadata. Set includeLocales=true to also fetch localized names and descriptions per language/region.",
      inputSchema: {
        adamId: z.number().describe("The app Adam ID"),
        includeLocales: z.boolean().optional().describe("Also fetch localized names/descriptions per locale"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ adamId, includeLocales }) => {
      try {
        const resp = await client.get<ApiResponse<Record<string, unknown>>>(`/apps/${adamId}`);

        const content: { type: "text"; text: string }[] = [
          { type: "text", text: `App details for Adam ID ${adamId}:` },
          { type: "text", text: JSON.stringify(resp.data, null, 2) },
        ];

        if (includeLocales) {
          const locales = await client.get<ApiListResponse<Record<string, unknown>>>(`/apps/${adamId}/locale-details`);
          content.push(
            { type: "text", text: `\n${locales.data.length} locale(s):` },
            { type: "text", text: JSON.stringify(locales.data, null, 2) },
          );
        }

        return { content };
      } catch (err) {
        return handleToolError(err);
      }
    }
  );

  server.registerTool(
    "find_app_assets",
    {
      title: "Find App Assets",
      description: "Find app assets (screenshots, app previews, etc.) using filters. Useful for checking which visual assets are available before creating creatives. Filter by device class, orientation, or asset type using conditions.",
      inputSchema: {
        adamId: z.number().describe("The app Adam ID"),
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
    },
    async ({ adamId, limit, offset, sortBy, sortOrder, conditions }) => {
      try {
        const selector = buildSelector({ limit, offset, sortBy, sortOrder, conditions });
        const resp = await client.post<ApiListResponse<Record<string, unknown>>>(`/apps/${adamId}/assets/find`, selector);

        return {
          content: [
            { type: "text", text: `Found ${resp.data.length} asset(s) for app ${adamId}.` },
            { type: "text", text: JSON.stringify(resp.data, null, 2) },
          ],
        };
      } catch (err) {
        return handleToolError(err);
      }
    }
  );

  // get_supported_countries_regions is now a Resource (apple-ads://countries)

  server.registerTool(
    "search_geolocations",
    {
      title: "Search / Lookup Geo Locations",
      description: "Search or look up geo locations for campaign geo targeting. Search by name (query) to find locations, or provide geoIds to look up specific locations by ID. Returns location display name, entity type (Country/AdminArea/Locality), and ID for use in ad group targeting.",
      inputSchema: {
        query: z.string().optional().describe("Search query (e.g., 'New York', 'United Kingdom')"),
        entity: z.string().optional().describe("Entity type filter: Country, AdminArea, Locality"),
        countryCode: z.string().optional().describe("Filter by country code (e.g., 'US')"),
        geoIds: z.array(z.string()).optional().describe("Array of geo location IDs to look up (alternative to query)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ query, entity, countryCode, geoIds }) => {
      try {
        if (!query && !geoIds?.length) {
          return { content: [{ type: "text", text: "Please provide either a query or geoIds." }] };
        }

        let resp: ApiListResponse<GeoLocation>;

        if (geoIds?.length) {
          const geoRequests = geoIds.map((id) => {
            const pipes = id.split("|").length - 1;
            const inferredEntity = pipes >= 2 ? "Locality" : pipes === 1 ? "AdminArea" : "Country";
            return { id, entity: inferredEntity };
          });
          resp = await client.post<ApiListResponse<GeoLocation>>("/search/geo", geoRequests);
        } else {
          const params: Record<string, string> = { query: query! };
          if (entity) params.entity = entity;
          if (countryCode) params.countrycode = countryCode;
          resp = await client.get<ApiListResponse<GeoLocation>>("/search/geo", params);
        }

        const text = resp.data
          .map((geo) => {
            const base = `${geo.displayName} (${geo.entity}, ID: ${geo.id})`;
            return geo.countryOrRegion ? `${base} — ${geo.countryOrRegion}` : base;
          })
          .join("\n");

        return {
          content: [
            { type: "text", text: `Found ${resp.data.length} location(s):\n${text}` },
            { type: "text", text: JSON.stringify(resp.data, null, 2) },
          ],
        };
      } catch (err) {
        return handleToolError(err);
      }
    }
  );
}
