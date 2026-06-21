export type CalendarViewMode = 'month' | 'week' | 'day'

export function formatSqlTimestamp(date: Date): string {
    const pad = (part: number) => String(part).padStart(2, '0')

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function parseSqlTimestamp(value: string | null | undefined): Date | null {
    if (!value) return null

    const trimmed = value.trim()
    const naiveMatch = trimmed.match(
        /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/,
    )

    if (naiveMatch) {
        const year = Number(naiveMatch[1])
        const month = Number(naiveMatch[2]) - 1
        const day = Number(naiveMatch[3])
        const hour = Number(naiveMatch[4])
        const minute = Number(naiveMatch[5])
        const second = Number(naiveMatch[6] ?? 0)
        const parsed = new Date(year, month, day, hour, minute, second)

        return Number.isNaN(parsed.getTime()) ? null : parsed
    }

    const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T')
    const parsed = new Date(normalized)

    return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function isSameDay(left: Date, right: Date): boolean {
    return (
        left.getFullYear() === right.getFullYear()
        && left.getMonth() === right.getMonth()
        && left.getDate() === right.getDate()
    )
}

export function isToday(date: Date): boolean {
    return isSameDay(date, new Date())
}

export function startOfDay(date: Date): Date {
    const copy = new Date(date)
    copy.setHours(0, 0, 0, 0)
    return copy
}

export function endOfDay(date: Date): Date {
    const copy = new Date(date)
    copy.setHours(23, 59, 59, 999)
    return copy
}

export function addDays(date: Date, days: number): Date {
    const copy = new Date(date)
    copy.setDate(copy.getDate() + days)
    return copy
}

export function addMonths(date: Date, months: number): Date {
    const copy = new Date(date)
    copy.setMonth(copy.getMonth() + months)
    return copy
}

export function startOfWeek(date: Date): Date {
    const copy = startOfDay(date)
    const weekday = copy.getDay()
    const diff = weekday === 0 ? -6 : 1 - weekday
    return addDays(copy, diff)
}

export function endOfWeek(date: Date): Date {
    return endOfDay(addDays(startOfWeek(date), 6))
}

export function startOfMonth(date: Date): Date {
    const copy = new Date(date.getFullYear(), date.getMonth(), 1)
    copy.setHours(0, 0, 0, 0)
    return copy
}

export function endOfMonth(date: Date): Date {
    const copy = new Date(date.getFullYear(), date.getMonth() + 1, 0)
    copy.setHours(23, 59, 59, 999)
    return copy
}

export function getMonthGrid(anchor: Date): Date[] {
    const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const gridStart = startOfWeek(firstOfMonth)

    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
}

export function getWeekDays(anchor: Date): Date[] {
    const weekStart = startOfWeek(anchor)
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
}

export function formatMonthYear(date: Date): string {
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function formatWeekRange(anchor: Date): string {
    const days = getWeekDays(anchor)
    const start = days[0]
    const end = days[6]

    if (start.getMonth() === end.getMonth()) {
        return `${start.toLocaleDateString(undefined, { month: 'long' })} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`
    }

    if (start.getFullYear() === end.getFullYear()) {
        return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${start.getFullYear()}`
    }

    return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
}

export function formatDayTitle(date: Date): string {
    return date.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    })
}

export function defaultSessionRange(day: Date, hour = 9): { start: Date; end: Date } {
    const start = new Date(day)
    start.setHours(hour, 0, 0, 0)

    const end = new Date(start)
    end.setHours(hour + 1, 0, 0, 0)

    return { start, end }
}

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const HOUR_LABELS = Array.from({ length: 24 }, (_, hour) => hour)
