import { getAccessToken } from "../auth/oauth.js";
const BASE_URL = "https://api.searchads.apple.com/api/v5";
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 30_000;
export class AppleAdsApiError extends Error {
    status;
    method;
    path;
    body;
    constructor(status, method, path, body) {
        super(`Apple Ads API error: ${method} ${path} returned ${status}: ${body}`);
        this.status = status;
        this.method = method;
        this.path = path;
        this.body = body;
    }
}
export class AppleAdsClient {
    config;
    orgId;
    constructor(config) {
        this.config = config;
        this.orgId = config.orgId;
    }
    getOrgId() {
        return this.orgId;
    }
    setOrgId(orgId) {
        this.orgId = orgId;
    }
    requireOrgId() {
        if (!this.orgId) {
            throw new Error("No organization selected. Use list_organizations to see available orgs, then switch_organization to select one.");
        }
        return this.orgId;
    }
    async get(path, params, options) {
        const url = new URL(`${BASE_URL}${path}`);
        if (params) {
            for (const [k, v] of Object.entries(params)) {
                url.searchParams.set(k, v);
            }
        }
        return this.request("GET", url.toString(), undefined, 1, options?.skipOrgHeader);
    }
    async post(path, body) {
        return this.request("POST", `${BASE_URL}${path}`, body);
    }
    async put(path, body) {
        return this.request("PUT", `${BASE_URL}${path}`, body);
    }
    async delete(path) {
        return this.request("DELETE", `${BASE_URL}${path}`);
    }
    async request(method, url, body, attempt = 1, skipOrgHeader = false) {
        const token = await getAccessToken(this.config);
        const headers = {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        };
        if (!skipOrgHeader) {
            headers["X-AP-Context"] = `orgId=${this.requireOrgId()}`;
        }
        const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (response.status === 429 || (response.status >= 500 && attempt < MAX_RETRIES)) {
            const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
            console.error(`[api] ${method} ${url} returned ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
            await sleep(delay);
            return this.request(method, url, body, attempt + 1, skipOrgHeader);
        }
        if (response.status === 204 || response.headers.get("content-length") === "0") {
            return {};
        }
        if (!response.ok) {
            const text = await response.text();
            throw new AppleAdsApiError(response.status, method, url, text);
        }
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
            return (await response.json());
        }
        return (await response.text());
    }
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=api-client.js.map