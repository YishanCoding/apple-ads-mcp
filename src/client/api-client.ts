import type { Config } from "../config.js";
import { getAccessToken } from "../auth/oauth.js";

const BASE_URL = "https://api.searchads.apple.com/api/v5";
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 30_000;

export class AppleAdsApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly method: string,
    public readonly path: string,
    public readonly body: string,
  ) {
    super(`Apple Ads API error: ${method} ${path} returned ${status}: ${body}`);
  }
}

export class AppleAdsClient {
  private orgId: string | undefined;

  constructor(private config: Config) {
    this.orgId = config.orgId;
  }

  getOrgId(): string | undefined {
    return this.orgId;
  }

  setOrgId(orgId: string): void {
    this.orgId = orgId;
  }

  private requireOrgId(): string {
    if (!this.orgId) {
      throw new Error(
        "No organization selected. Use list_organizations to see available orgs, then switch_organization to select one."
      );
    }
    return this.orgId;
  }

  async get<T>(path: string, params?: Record<string, string>, options?: { skipOrgHeader?: boolean }): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }
    return this.request<T>("GET", url.toString(), undefined, 1, options?.skipOrgHeader);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", `${BASE_URL}${path}`, body);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", `${BASE_URL}${path}`, body);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", `${BASE_URL}${path}`);
  }

  private async request<T>(
    method: string,
    url: string,
    body?: unknown,
    attempt = 1,
    skipOrgHeader = false
  ): Promise<T> {
    const token = await getAccessToken(this.config);
    const headers: Record<string, string> = {
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
      console.error(
        `[api] ${method} ${url} returned ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
      );
      await sleep(delay);
      return this.request<T>(method, url, body, attempt + 1, skipOrgHeader);
    }

    if (response.status === 204 || response.headers.get("content-length") === "0") {
      return {} as T;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new AppleAdsApiError(response.status, method, url, text);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return (await response.json()) as T;
    }
    return (await response.text()) as unknown as T;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
