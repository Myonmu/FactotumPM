import { parseSqlTimestamp } from '$lib/calendar/dates'

const SECOND_MS = 1000
const MINUTE_MS = 60 * SECOND_MS
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const MONTH_MS = 30 * DAY_MS
const YEAR_MS = 365 * DAY_MS

const FUTURE_EXACT_AFTER_MS = 14 * MONTH_MS
const PAST_YEAR_AFTER_MS = YEAR_MS
const PAST_EXACT_AFTER_MS = 5 * YEAR_MS

function formatExactDate(date: Date): string {
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    })
}

function formatDurationShort(
    diffMs: number,
    options: { allowYears?: boolean; exactDate?: Date },
): string {
    const { allowYears = false, exactDate } = options

    if (diffMs < MINUTE_MS) {
        const seconds = Math.max(1, Math.floor(diffMs / SECOND_MS))
        return `${seconds}s`
    }

    if (diffMs < HOUR_MS) {
        return `${Math.floor(diffMs / MINUTE_MS)}m`
    }

    if (diffMs < DAY_MS) {
        return `${Math.floor(diffMs / HOUR_MS)}h`
    }

    if (diffMs < MONTH_MS) {
        return `${Math.floor(diffMs / DAY_MS)}d`
    }

    if (allowYears) {
        if (diffMs >= PAST_EXACT_AFTER_MS && exactDate) {
            return formatExactDate(exactDate)
        }

        if (diffMs >= PAST_YEAR_AFTER_MS) {
            return `${Math.floor(diffMs / YEAR_MS)}y`
        }
    } else if (diffMs >= FUTURE_EXACT_AFTER_MS && exactDate) {
        return formatExactDate(exactDate)
    }

    return `${Math.floor(diffMs / MONTH_MS)}mo`
}

export function formatSessionRelativeTime(
    session: { started_at: string; ended_at: string },
    now: Date = new Date(),
): string {
    const start = parseSqlTimestamp(session.started_at)
    const end = parseSqlTimestamp(session.ended_at)

    if (!start || !end) return ''

    const nowMs = now.getTime()
    const startMs = start.getTime()
    const endMs = end.getTime()

    if (endMs <= nowMs) {
        const diffMs = nowMs - endMs
        const label = formatDurationShort(diffMs, { allowYears: true, exactDate: end })
        return `${label} ago`
    }

    if (startMs > nowMs) {
        const diffMs = startMs - nowMs
        const label = formatDurationShort(diffMs, { exactDate: start })
        return `in ${label}`
    }

    const diffMs = endMs - nowMs
    const label = formatDurationShort(diffMs, { exactDate: end })
    return `ends in ${label}`
}
