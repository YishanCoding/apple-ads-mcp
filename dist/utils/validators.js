const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function validateDate(value, fieldName) {
    if (!DATE_RE.test(value) || isNaN(Date.parse(value))) {
        throw new Error(`Invalid ${fieldName}: "${value}". Expected YYYY-MM-DD format.`);
    }
}
//# sourceMappingURL=validators.js.map