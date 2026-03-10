import type { Selector, Condition, SortOrder } from "../types/reporting.js";

export interface SelectorOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: "ASCENDING" | "DESCENDING";
  conditions?: Condition[];
}

export function buildSelector(opts: SelectorOptions = {}): Selector {
  const selector: Selector = {};

  if (opts.limit !== undefined || opts.offset !== undefined) {
    selector.pagination = {
      offset: opts.offset ?? 0,
      limit: opts.limit ?? 1000,
    };
  }

  if (opts.sortBy) {
    const orderBy: SortOrder[] = [
      {
        field: opts.sortBy,
        sortOrder: opts.sortOrder ?? "DESCENDING",
      },
    ];
    selector.orderBy = orderBy;
  }

  if (opts.conditions && opts.conditions.length > 0) {
    selector.conditions = opts.conditions;
  }

  return selector;
}
