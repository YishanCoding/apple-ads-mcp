import type { MetricData } from "../types/reporting.js";
import type { Ad, BudgetOrder, Campaign, Creative, Money } from "../types/apple-ads.js";

export function formatMoney(m: Money | { amount: string; currency: string } | null | undefined): string {
  if (!m || m.amount == null || m.currency == null) return "N/A";
  const amount = parseFloat(m.amount);
  if (isNaN(amount)) return "N/A";
  return `${m.currency} ${amount.toFixed(2)}`;
}

export function formatMetrics(m: MetricData): string {
  const lines = [
    `Impressions: ${(m.impressions ?? 0).toLocaleString()}`,
    `Taps: ${(m.taps ?? 0).toLocaleString()}`,
    `TTR: ${((m.ttr ?? 0) * 100).toFixed(2)}%`,
    `Installs: ${(m.totalInstalls ?? 0).toLocaleString()}`,
    `New Downloads: ${(m.totalNewDownloads ?? 0).toLocaleString()}`,
    `Redownloads: ${(m.totalRedownloads ?? 0).toLocaleString()}`,
    `Conversion Rate: ${((m.conversionRate ?? 0) * 100).toFixed(2)}%`,
    `Avg CPA: ${formatMoney(m.avgCPA)}`,
    `Avg CPT: ${formatMoney(m.avgCPT)}`,
    `Spend: ${formatMoney(m.localSpend)}`,
  ];
  return lines.join("\n");
}

export function formatCampaignSummary(c: Campaign): string {
  return [
    `Campaign: ${c.name} (ID: ${c.id})`,
    `Status: ${c.displayStatus}`,
    `Budget: ${formatMoney(c.budgetAmount)} (Daily: ${formatMoney(c.dailyBudgetAmount)})`,
    `Countries: ${c.countriesOrRegions?.join(", ") ?? "N/A"}`,
    `App Adam ID: ${c.adamId}`,
  ].join("\n");
}

export function formatAdSummary(ad: Ad): string {
  return [
    `Ad: ${ad.name} (ID: ${ad.id})`,
    `Status: ${ad.servingStatus}`,
    `Creative ID: ${ad.creativeId}`,
    `Campaign ID: ${ad.campaignId}, Ad Group ID: ${ad.adGroupId}`,
    ad.rejectionReasons?.length
      ? `Rejection Reasons: ${ad.rejectionReasons.map((r) => r.message).join("; ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatBudgetOrderSummary(bo: BudgetOrder): string {
  return [
    `Budget Order: ${bo.name} (ID: ${bo.id})`,
    `Status: ${bo.status}`,
    `Budget: ${formatMoney(bo.budget)}`,
    `Start: ${bo.startDate}`,
    bo.endDate ? `End: ${bo.endDate}` : null,
    bo.orderNumber ? `Order #: ${bo.orderNumber}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatCreativeSummary(c: Creative): string {
  return [
    `Creative: ${c.name} (ID: ${c.id})`,
    `Type: ${c.type}`,
    `State: ${c.state}`,
    `Adam ID: ${c.adamId}`,
  ].join("\n");
}
