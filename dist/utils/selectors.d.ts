import type { Selector, Condition } from "../types/reporting.js";
export interface SelectorOptions {
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: "ASCENDING" | "DESCENDING";
    conditions?: Condition[];
}
export declare function buildSelector(opts?: SelectorOptions): Selector;
