import type { Config } from "../config.js";
export declare class AppleAdsApiError extends Error {
    readonly status: number;
    readonly method: string;
    readonly path: string;
    readonly body: string;
    constructor(status: number, method: string, path: string, body: string);
}
export declare class AppleAdsClient {
    private config;
    private orgId;
    constructor(config: Config);
    getOrgId(): string | undefined;
    setOrgId(orgId: string): void;
    private requireOrgId;
    get<T>(path: string, params?: Record<string, string>, options?: {
        skipOrgHeader?: boolean;
    }): Promise<T>;
    post<T>(path: string, body?: unknown): Promise<T>;
    put<T>(path: string, body?: unknown): Promise<T>;
    delete<T>(path: string): Promise<T>;
    private request;
}
