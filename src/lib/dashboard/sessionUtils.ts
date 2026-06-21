import {
    addDays,
    endOfMonth,
    endOfWeek,
    isSameDay,
    parseSqlTimestamp,
    startOfMonth,
    startOfWeek,
} from '$lib/calendar/dates'
import {
    getSessionDisplayTitle,
    type SessionRecord,
} from '$lib/db/sessions'
import {
    SessionStatusCode,
    sessionStatusLabel,
} from '$lib/db/sessionStatus'

export { sessionStatusLabel }

export function isSessionOnDay(session: SessionRecord, day: Date): boolean {
    const start = parseSqlTimestamp(session.started_at)
    return start != null && isSameDay(start, day)
}

export function isNowWithinSession(session: SessionRecord, now: Date): boolean {
    const start = parseSqlTimestamp(session.started_at)
    const end = parseSqlTimestamp(session.ended_at)

    if (!start || !end) return false

    return now >= start && now < end
}

export function compareSessionsByStart(left: SessionRecord, right: SessionRecord): number {
    const leftStart = parseSqlTimestamp(left.started_at)?.getTime() ?? 0
    const rightStart = parseSqlTimestamp(right.started_at)?.getTime() ?? 0
    return leftStart - rightStart
}

export function isDashboardVisibleSession(session: SessionRecord): boolean {
    return session.status !== SessionStatusCode.NoLongerNeeded
}

export function findActiveStartedSession(
    sessions: SessionRecord[],
    _now: Date,
): SessionRecord | null {
    return (
        sessions
            .filter((entry) => entry.status === SessionStatusCode.Started)
            .sort(compareSessionsByStart)[0] ?? null
    )
}

export function findOverlappingPlannedSession(
    sessions: SessionRecord[],
    now: Date,
): SessionRecord | null {
    return (
        sessions
            .filter(
                (entry) =>
                    entry.status === SessionStatusCode.Planned
                    && isNowWithinSession(entry, now),
            )
            .sort(compareSessionsByStart)[0] ?? null
    )
}

export function isPlannedSessionPastEnd(session: SessionRecord, now: Date): boolean {
    if (session.status !== SessionStatusCode.Planned) return false

    const end = parseSqlTimestamp(session.ended_at)
    return end != null && end <= now
}

export function comparePastDueSessionsByRecency(
    left: SessionRecord,
    right: SessionRecord,
): number {
    const leftEnd = parseSqlTimestamp(left.ended_at)?.getTime() ?? 0
    const rightEnd = parseSqlTimestamp(right.ended_at)?.getTime() ?? 0
    return rightEnd - leftEnd
}

export function getPastDuePlannedSessions(
    sessions: SessionRecord[],
    now: Date,
): SessionRecord[] {
    return sessions
        .filter(
            (entry) =>
                entry.status === SessionStatusCode.Planned
                && isSessionOnDay(entry, now)
                && isPlannedSessionPastEnd(entry, now),
        )
        .sort(comparePastDueSessionsByRecency)
}

export function getMissedPlannedSessions(
    sessions: SessionRecord[],
    now: Date,
): SessionRecord[] {
    return sessions
        .filter(
            (entry) =>
                entry.status === SessionStatusCode.Planned
                && !isSessionOnDay(entry, now)
                && isPlannedSessionPastEnd(entry, now),
        )
        .sort(comparePastDueSessionsByRecency)
}

export type UpcomingSessionRange = 'today' | 'tomorrow' | 'week' | 'month'

export function isUpcomingPlannedSessionInRange(
    session: SessionRecord,
    now: Date,
    range: UpcomingSessionRange,
): boolean {
    if (session.status !== SessionStatusCode.Planned) return false
    if (isPlannedSessionPastEnd(session, now)) return false

    const start = parseSqlTimestamp(session.started_at)
    if (!start) return false

    switch (range) {
        case 'today':
            return isSessionOnDay(session, now)
        case 'tomorrow':
            return isSessionOnDay(session, addDays(now, 1))
        case 'week': {
            const weekStart = startOfWeek(now)
            const weekEnd = endOfWeek(now)
            return start >= weekStart && start <= weekEnd
        }
        case 'month': {
            const monthStart = startOfMonth(now)
            const monthEnd = endOfMonth(now)
            return start >= monthStart && start <= monthEnd
        }
    }
}

export function getUpcomingPlannedSessions(
    sessions: SessionRecord[],
    now: Date,
    range: UpcomingSessionRange,
    options: { excludeSessionIds?: string[] } = {},
): SessionRecord[] {
    const excludeIds = new Set(options.excludeSessionIds ?? [])

    return sessions
        .filter(
            (entry) =>
                !excludeIds.has(entry.id) && isUpcomingPlannedSessionInRange(entry, now, range),
        )
        .sort(compareSessionsByStart)
}

export function getUpcomingPlannedSessionsForDay(
    sessions: SessionRecord[],
    now: Date,
): SessionRecord[] {
    return getUpcomingPlannedSessions(sessions, now, 'today')
}

export function getPlannedSessionsForDay(
    sessions: SessionRecord[],
    day: Date,
): SessionRecord[] {
    return sessions
        .filter((entry) => entry.status === SessionStatusCode.Planned && isSessionOnDay(entry, day))
        .sort(compareSessionsByStart)
}

export function getNonEvaluatedSessions(sessions: SessionRecord[]): SessionRecord[] {
    return sessions
        .filter(
            (entry) =>
                entry.status === SessionStatusCode.Finished && entry.aftermath_id == null,
        )
        .sort(compareSessionsByStart)
}

export function sessionHasEvaluatedAftermath(
    session: Pick<SessionRecord, 'aftermath_id' | 'status'>,
): boolean {
    if (session.status !== SessionStatusCode.Finished) return false

    const id = session.aftermath_id
    return typeof id === 'string' && id.trim().length > 0
}

export function getSessionTaskIds(session: SessionRecord): string[] {
    return session.tasks.map((task) => task.id)
}

export { getSessionDisplayTitle }
