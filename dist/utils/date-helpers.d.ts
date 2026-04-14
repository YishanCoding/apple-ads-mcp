export type DatePreset = "LAST_7_DAYS" | "LAST_14_DAYS" | "LAST_30_DAYS" | "LAST_90_DAYS" | "THIS_MONTH" | "LAST_MONTH";
export declare function resolveDateRange(preset: DatePreset): {
    startDate: string;
    endDate: string;
};
export declare function formatDate(d: Date): string;
export declare function toISO8601(date: string): string;
