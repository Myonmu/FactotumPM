export const NULL_OPTION_VALUE = '__none__'

export function isNullOptionValue(value: unknown): boolean {
    return value === null || value === undefined || value === '' || value === NULL_OPTION_VALUE
}

export function normalizeOptionalValue(value: unknown): null | unknown {
    return isNullOptionValue(value) ? null : value
}
