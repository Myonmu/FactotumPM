/** Read boolean flags from Drizzle rows or legacy SQL/proxy values (0/1). */
export function readSqlBoolean(value: unknown): boolean {
    return value === true || value === 1 || value === '1'
}

/** Normalize boolean flags for Drizzle inserts/updates. */
export function toSqlBoolean(value: unknown): boolean {
    return readSqlBoolean(value)
}
