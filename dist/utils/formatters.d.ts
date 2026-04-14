import type { MetricData } from "../types/reporting.js";
import type { Ad, BudgetOrder, Campaign, Creative, Money } from "../types/apple-ads.js";
export declare function formatMoney(m: Money | {
    amount: string;
    currency: string;
} | null | undefined): string;
export declare function formatMetrics(m: MetricData): string;
export declare function formatCampaignSummary(c: Campaign): string;
export declare function formatAdSummary(ad: Ad): string;
export declare function formatBudgetOrderSummary(bo: BudgetOrder): string;
export declare function formatCreativeSummary(c: Creative): string;
