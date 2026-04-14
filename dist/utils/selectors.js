export function buildSelector(opts = {}) {
    const selector = {};
    if (opts.limit !== undefined || opts.offset !== undefined) {
        selector.pagination = {
            offset: opts.offset ?? 0,
            limit: opts.limit ?? 1000,
        };
    }
    if (opts.sortBy) {
        const orderBy = [
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
//# sourceMappingURL=selectors.js.map