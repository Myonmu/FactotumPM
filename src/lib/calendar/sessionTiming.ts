import {
    formatSqlTimestamp,
    parseSqlTimestamp,
    startOfDay,
} from '$lib/calendar/dates'
import { DAY_GRID_HEIGHT, MINUTES_PER_DAY } from '$lib/calendar/timeGrid'

export function snapMinutes(totalMinutes: number, interval: number): number {
    const safeInterval = Math.max(1, interval)
    return Math.round(totalMinutes / safeInterval) * safeInterval
}

export function clampMinutes(minutes: number, min = 0, max = MINUTES_PER_DAY): number {
    return Math.max(min, Math.min(max, minutes))
}

export function minutesFromDate(date: Date): number {
    return date.getHours() * 60 + date.getMinutes()
}

export function setTimeOnDay(day: Date, minutes: number): Date {
    const copy = startOfDay(day)
    const clamped = clampMinutes(minutes)
    copy.setHours(Math.floor(clamped / 60), clamped % 60, 0, 0)
    return copy
}

export function sessionDurationMinutes(startedAt: string, endedAt: string): number {
    const start = parseSqlTimestamp(startedAt)
    const end = parseSqlTimestamp(endedAt)

    if (!start || !end) return 60

    return Math.max((end.getTime() - start.getTime()) / 60000, 1)
}

export function moveSessionToDay(
    startedAt: string,
    endedAt: string,
    targetDay: Date,
): { started_at: string; ended_at: string } {
    const start = parseSqlTimestamp(startedAt)
    const end = parseSqlTimestamp(endedAt)

    if (!start || !end) {
        throw new Error('Invalid session timestamps')
    }

    const durationMs = end.getTime() - start.getTime()
    const newStart = setTimeOnDay(targetDay, minutesFromDate(start))
    const newEnd = new Date(newStart.getTime() + durationMs)

    return {
        started_at: formatSqlTimestamp(newStart),
        ended_at: formatSqlTimestamp(newEnd),
    }
}

export function moveSessionByMinutes(
    startedAt: string,
    endedAt: string,
    deltaMinutes: number,
    targetDay?: Date,
): { started_at: string; ended_at: string } {
    const start = parseSqlTimestamp(startedAt)
    const end = parseSqlTimestamp(endedAt)

    if (!start || !end) {
        throw new Error('Invalid session timestamps')
    }

    let newStart = new Date(start.getTime() + deltaMinutes * 60000)
    let newEnd = new Date(end.getTime() + deltaMinutes * 60000)

    if (targetDay) {
        newStart = setTimeOnDay(targetDay, minutesFromDate(newStart))
        const durationMs = end.getTime() - start.getTime()
        newEnd = new Date(newStart.getTime() + durationMs)
    }

    return {
        started_at: formatSqlTimestamp(newStart),
        ended_at: formatSqlTimestamp(newEnd),
    }
}

export function resizeSessionStart(
    startedAt: string,
    endedAt: string,
    newStartMinutes: number,
    snapInterval: number,
    targetDay?: Date,
): { started_at: string; ended_at: string } {
    const end = parseSqlTimestamp(endedAt)
    if (!end) throw new Error('Invalid session end time')

    const endMinutes = minutesFromDate(end)
    const snapped = snapMinutes(newStartMinutes, snapInterval)
    const maxStart = endMinutes - snapInterval
    const clamped = clampMinutes(snapped, 0, maxStart)

    const day = targetDay ?? end
    const newStart = setTimeOnDay(day, clamped)

    return {
        started_at: formatSqlTimestamp(newStart),
        ended_at: endedAt,
    }
}

export function resizeSessionEnd(
    startedAt: string,
    endedAt: string,
    newEndMinutes: number,
    snapInterval: number,
    targetDay?: Date,
): { started_at: string; ended_at: string } {
    const start = parseSqlTimestamp(startedAt)
    if (!start) throw new Error('Invalid session start time')

    const startMinutes = minutesFromDate(start)
    const snapped = snapMinutes(newEndMinutes, snapInterval)
    const minEnd = startMinutes + snapInterval
    const clamped = clampMinutes(snapped, minEnd, MINUTES_PER_DAY)

    const day = targetDay ?? start
    const newEnd = setTimeOnDay(day, clamped)

    return {
        started_at: startedAt,
        ended_at: formatSqlTimestamp(newEnd),
    }
}

export function placeSessionAtMinutes(
    startedAt: string,
    endedAt: string,
    startMinutes: number,
    snapInterval: number,
    targetDay: Date,
): { started_at: string; ended_at: string } {
    const duration = sessionDurationMinutes(startedAt, endedAt)
    const snapped = snapMinutes(startMinutes, snapInterval)
    const maxStart = MINUTES_PER_DAY - duration
    const clamped = clampMinutes(snapped, 0, maxStart)
    const newStart = setTimeOnDay(targetDay, clamped)
    const newEnd = new Date(newStart.getTime() + duration * 60000)

    return {
        started_at: formatSqlTimestamp(newStart),
        ended_at: formatSqlTimestamp(newEnd),
    }
}

export function dayFromPointer(event: PointerEvent): Date | null {
    const element = document.elementFromPoint(event.clientX, event.clientY)
    const column = element?.closest('[data-calendar-day]') as HTMLElement | null
    const value = column?.dataset.calendarDay

    if (!value) return null

    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function minutesFromPointer(
    event: PointerEvent,
    scrollRoot: HTMLElement,
    snapInterval: number,
): number {
    const rect = scrollRoot.getBoundingClientRect()
    const relativeY = event.clientY - rect.top + scrollRoot.scrollTop
    const rawMinutes = (relativeY / DAY_GRID_HEIGHT) * MINUTES_PER_DAY

    return clampMinutes(snapMinutes(rawMinutes, snapInterval))
}
