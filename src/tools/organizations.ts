import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppleAdsClient } from "../client/api-client.js";
import type { ApiListResponse, ApiResponse, OrgAcl, MeDetail } from "../types/apple-ads.js";
import { saveState } from "../state.js";
import { handleToolError } from "../utils/error-handler.js";

export function registerOrganizationTools(server: McpServer, client: AppleAdsClient) {
  server.registerTool(
    "list_organizations",
    {
      title: "List Organizations",
      description: "List all organizations (campaign groups) you have access to. Shows org ID, name, currency, payment model, and your roles. Call this first to find the right org, then use switch_organization to set the active org for all subsequent API calls.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => {
      try {
        const resp = await client.get<ApiListResponse<OrgAcl>>("/acls", undefined, { skipOrgHeader: true });
        const currentOrgId = client.getOrgId();

        const lines = resp.data.map((org) => {
          const active = String(org.orgId) === currentOrgId ? " [ACTIVE]" : "";
          return `${org.orgName} (ID: ${org.orgId})${active}\n  Currency: ${org.currency}\n  Roles: ${org.roleNames?.join(", ") ?? "N/A"}`;
        });

        const text = [
          `Found ${resp.data.length} organization(s):`,
          currentOrgId ? `Currently active: ${currentOrgId}` : "No organization selected yet.",
          "",
          ...lines,
        ].join("\n");

        return {
          content: [
            { type: "text", text },
            { type: "text", text: JSON.stringify(resp.data, null, 2) },
          ],
        };
      } catch (err) {
        return handleToolError(err);
      }
    }
  );

  server.registerTool(
    "get_me_details",
    {
      title: "Get Current User",
      description: "Get details about the currently authenticated API user including user ID and parent org ID. Useful for debugging authentication issues.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => {
      try {
        const resp = await client.get<ApiResponse<MeDetail>>("/me", undefined, { skipOrgHeader: true });

        return {
          content: [
            { type: "text", text: `User ID: ${resp.data.userId}\nParent Org ID: ${resp.data.parentOrgId}` },
            { type: "text", text: JSON.stringify(resp.data, null, 2) },
          ],
        };
      } catch (err) {
        return handleToolError(err);
      }
    }
  );

  server.registerTool(
    "switch_organization",
    {
      title: "Switch Organization",
      description: "Switch the active organization context. All subsequent API calls (campaigns, reports, etc.) will operate under this org. The switch persists across sessions. Use list_organizations to see available orgs and their IDs.",
      inputSchema: {
        orgId: z.string().describe("The organization ID to switch to"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ orgId }) => {
      try {
        client.setOrgId(orgId);
        saveState({ orgId });
        return {
          content: [
            { type: "text", text: `Switched to organization ${orgId}. All subsequent API calls will use this org.` },
          ],
        };
      } catch (err) {
        return handleToolError(err);
      }
    }
  );
}
