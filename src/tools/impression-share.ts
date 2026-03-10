import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppleAdsClient } from "../client/api-client.js";
import type { ApiListResponse, ApiResponse, CustomReport } from "../types/apple-ads.js";
import { handleToolError } from "../utils/error-handler.js";
import { validateDate } from "../utils/validators.js";

export function registerImpressionShareTools(server: McpServer, client: AppleAdsClient) {
  server.registerTool("create_impression_share_report", {
    title: "Create Custom Impression Share Report",
    description: "Create an async custom impression share report. Returns a report ID — poll with get_impression_share_report_by_id until status is COMPLETED. These reports provide detailed impression share data not available in standard keyword reports. Takes minutes to generate.",
    inputSchema: {
      name: z.string().describe("Report name"),
      startTime: z.string().describe("Start date (YYYY-MM-DD)"),
      endTime: z.string().describe("End date (YYYY-MM-DD)"),
      granularity: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).optional().describe("Time granularity (default DAILY)"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async ({ name, startTime, endTime, granularity }) => {
    try {
      validateDate(startTime, "startTime");
      validateDate(endTime, "endTime");

      const body = {
        name,
        startTime,
        endTime,
        granularity: granularity ?? "DAILY",
      };

      const resp = await client.post<ApiResponse<CustomReport>>("/custom-reports", body);

      return {
        content: [
          { type: "text", text: `Created impression share report "${resp.data.name}" (ID: ${resp.data.id})\nStatus: ${resp.data.state}` },
          { type: "text", text: JSON.stringify(resp.data, null, 2) },
        ],
      };
    } catch (err) {
      return handleToolError(err);
    }
  });

  server.registerTool("get_impression_share_report_by_id", {
    title: "Get Impression Share Report",
    description: "Get an impression share report by ID. Poll until state=COMPLETED (typically 1-5 minutes). The report contains detailed impression share and rank data per keyword.",
    inputSchema: {
      reportId: z.number().describe("The report ID"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ reportId }) => {
    try {
      const resp = await client.get<ApiResponse<CustomReport>>(`/custom-reports/${reportId}`);

      return {
        content: [
          { type: "text", text: `Report "${resp.data.name}" (ID: ${resp.data.id})\nStatus: ${resp.data.state}` },
          { type: "text", text: JSON.stringify(resp.data, null, 2) },
        ],
      };
    } catch (err) {
      return handleToolError(err);
    }
  });

  server.registerTool("list_impression_share_reports", {
    title: "List Impression Share Reports",
    description: "List all custom impression share reports with their status (QUEUED, RUNNING, COMPLETED, FAILED). Use to find previously created reports.",
    inputSchema: {
      limit: z.number().optional().describe("Max results (default 50)"),
      offset: z.number().optional().describe("Pagination offset"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ limit, offset }) => {
    try {
      const params: Record<string, string> = {
        limit: String(limit ?? 50),
        offset: String(offset ?? 0),
      };

      const resp = await client.get<ApiListResponse<CustomReport>>("/custom-reports", params);

      const text = resp.data
        .map((r) => `${r.name} (ID: ${r.id}) — Status: ${r.state}`)
        .join("\n");

      return {
        content: [
          { type: "text", text: `Found ${resp.data.length} report(s):\n${text}` },
          { type: "text", text: JSON.stringify(resp.data, null, 2) },
        ],
      };
    } catch (err) {
      return handleToolError(err);
    }
  });
}
