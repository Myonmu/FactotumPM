import type { EventInput } from '@fullcalendar/core'

import { formatSqlTimestamp, parseSqlTimestamp } from '$lib/calendar/dates'
import { colorIntToHex } from '$lib/grid/colorUtils'
import { sessionHasEvaluatedAftermath } from '$lib/dashboard/sessionUtils'
import { getSessionDisplayTitle, type SessionRecord } from '$lib/db/sessions'

export function sessionToFullCalendarEvent(session: SessionRecord): EventInput {
    const start = parseSqlTimestamp(session.started_at)
    const end = parseSqlTimestamp(session.ended_at)
    const hex = colorIntToHex(session.task_color)

    return {
        id: session.id,
        title: getSessionDisplayTitle(session),
        start: start ?? undefined,
        end: end ?? undefined,
        editable: true,
        classNames: sessionHasEvaluatedAftermath(session) ? ['fc-session-evaluated'] : [],
        extendedProps: {
            session,
        },
        borderColor: hex ?? undefined,
        backgroundColor: hex ? `${hex}2e` : undefined,
    }
}

export function sessionsToFullCalendarEvents(sessions: SessionRecord[]): EventInput[] {
    return sessions.map(sessionToFullCalendarEvent)
}

export function fullCalendarRangeToSqlTimestamps(start: Date, end: Date): {
    started_at: string
    ended_at: string
} {
    return {
        started_at: formatSqlTimestamp(start),
        ended_at: formatSqlTimestamp(end),
    }
}
