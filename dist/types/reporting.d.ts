export interface ReportingRequest {
    startTime: string;
    endTime: string;
    granularity?: "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY";
    groupBy?: string[];
    selector?: Selector;
    returnGrandTotals?: boolean;
    returnRecordsWithNoMetrics?: boolean;
    returnRowTotals?: boolean;
    timeZone?: string;
}
export interface Selector {
    conditions?: Condition[];
    fields?: string[];
    orderBy?: SortOrder[];
    pagination?: {
        offset: number;
        limit: number;
    };
}
export interface Condition {
    field: string;
    operator: "EQUALS" | "GREATER_THAN" | "LESS_THAN" | "IN" | "LIKE" | "STARTSWITH" | "CONTAINS" | "NOT_EQUALS";
    values: string[];
}
export interface SortOrder {
    field: string;
    sortOrder: "ASCENDING" | "DESCENDING";
}
export interface MetricData {
    impressions: number;
    taps: number;
    totalInstalls: number;
    totalNewDownloads: number;
    totalRedownloads: number;
    latOnInstalls: number;
    latOffInstalls: number;
    ttr: number;
    avgCPA: {
        amount: string;
        currency: string;
    };
    avgCPT: {
        amount: string;
        currency: string;
    };
    localSpend: {
        amount: string;
        currency: string;
    };
    conversionRate: number;
}
export interface ReportRow<M = Record<string, unknown>> {
    metadata: M;
    total: MetricData;
    granularity?: Array<{
        date: string;
    } & MetricData>;
    insights?: Record<string, unknown>;
}
export interface ReportResponse<M = Record<string, unknown>> {
    data: {
        reportingDataResponse: {
            row: ReportRow<M>[];
        };
    };
    pagination?: {
        totalResults: number;
        startIndex: number;
        itemsPerPage: number;
    };
}
