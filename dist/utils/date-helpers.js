export function resolveDateRange(preset) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (preset) {
        case "LAST_7_DAYS":
            return { startDate: daysAgo(today, 7), endDate: daysAgo(today, 1) };
        case "LAST_14_DAYS":
            return { startDate: daysAgo(today, 14), endDate: daysAgo(today, 1) };
        case "LAST_30_DAYS":
            return { startDate: daysAgo(today, 30), endDate: daysAgo(today, 1) };
        case "LAST_90_DAYS":
            return { startDate: daysAgo(today, 90), endDate: daysAgo(today, 1) };
        case "THIS_MONTH":
            return {
                startDate: formatDate(new Date(today.getFullYear(), today.getMonth(), 1)),
                endDate: daysAgo(today, 1),
            };
        case "LAST_MONTH": {
            const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const lastOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
            return {
                startDate: formatDate(firstOfLastMonth),
                endDate: formatDate(lastOfLastMonth),
            };
        }
    }
}
function daysAgo(from, days) {
    const d = new Date(from);
    d.setDate(d.getDate() - days);
    return formatDate(d);
}
export function formatDate(d) {
    return d.toISOString().split("T")[0];
}
export function toISO8601(date) {
    if (date.includes("T"))
        return date;
    return `${date}T00:00:00.000`;
}
//# sourceMappingURL=date-helpers.js.map