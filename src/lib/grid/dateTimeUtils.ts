import { formatSqlTimestamp, parseSqlTimestamp } from '$lib/calendar/dates'

export function formatDateTimeValue(value: unknown): string {
    if (value === null || value === undefined || value === '') {
        return ''
    }

    const parsed = parseDateTimeValue(value)
    if (!parsed) {
        return String(value)
    }

    return parsed.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

export function parseDateTimeValue(value: unknown): Date | null {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value
    }

    if (typeof value === 'number') {
        const parsed = new Date(value)
        return Number.isNaN(parsed.getTime()) ? null : parsed
    }

    if (typeof value !== 'string') {
        return null
    }

    return parseSqlTimestamp(value)
}

export function formatDateToSql(value: Date): string {
    return formatSqlTimestamp(value)
}
