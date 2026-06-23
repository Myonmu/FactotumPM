import { and, eq, gt, inArray, isNull } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'

import { getDb } from '$lib/db'
import { session, sessionEdge, task } from '$lib/db/schema'
import { getCurrentProjectId } from '$lib/projectState.svelte'
import { formatSqlTimestamp, parseSqlTimestamp } from '$lib/calendar/dates'
import { loadDomainOptions, taskHasChildren, type TaskRef } from '$lib/db/dataView'
import {
    normalizeSessionStatus,
    SessionStatusCode,
} from '$lib/db/sessionStatus'
import { resolveTaskColor } from '$lib/grid/colorUtils'
import { invalidateTrophyTimeCache } from '$lib/trophy/trophyTime'
import { markSessionTimeStale } from '$lib/sessionTime.svelte'

function onSessionDataChanged(): void {
    invalidateTrophyTimeCache()
    markSessionTimeStale()
}

export type { SessionStatusCode } from '$lib/db/sessionStatus'
export { SESSION_STATUS_OPTIONS, sessionStatusLabel } from '$lib/db/sessionStatus'

export type SessionRecord = {
    id: string
    started_at: string
    ended_at: string
    status: SessionStatusCode
    aftermath_id: string | null
    project_id: string | null
    tasks: TaskRef[]
    task_title: string | null
    task_color: number | null
}

export type SessionInput = {
    id?: string
    started_at: string
    ended_at: string
    status?: SessionStatusCode
    task_ids: string[]
    aftermath_id?: string | null
    project_id?: string | null
}

type SessionRow = {
    id: string
    started_at: string | null
    ended_at: string | null
    status: number | null
    aftermath_id: string | null
    project_id: string | null
}

type SessionTaskRow = {
    session_id: string
    id: string
    title: string | null
    parent_task_id: string | null
    domain_id: string | null
    color: number | null
    is_trophy: number | null
    uncertainty: number | null
    uncertainty_can_estimate: number | null
    complexity: number | null
    complexity_can_estimate: number | null
    effort: number | null
    effort_can_estimate: number | null
}

function normalizeOptionalId(value: unknown): string | null {
    if (value == null) return null

    const text = String(value).trim()
    if (!text || text === 'null') return null

    return text
}

function uniqueTaskIds(taskIds: string[]): string[] {
    const seen = new Set<string>()
    const result: string[] = []

    for (const taskId of taskIds) {
        const trimmed = taskId.trim()
        if (!trimmed || seen.has(trimmed)) continue
        seen.add(trimmed)
        result.push(trimmed)
    }

    return result
}

export function getSessionDisplayTitle(session: Pick<SessionRecord, 'tasks' | 'task_title'>): string {
    if (session.tasks.length === 0) {
        return session.task_title ?? 'Untitled session'
    }

    if (session.tasks.length === 1) {
        return session.tasks[0].title
    }

    return `${session.tasks[0].title} +${session.tasks.length - 1} more`
}

function mapTaskRef(row: SessionTaskRow): TaskRef {
    return {
        id: row.id,
        title: row.title ?? 'Untitled task',
        parent_task_id: row.parent_task_id ?? null,
        domain_id: row.domain_id ?? null,
        color: row.color ?? null,
        is_trophy: row.is_trophy ?? null,
        uncertainty: row.uncertainty ?? null,
        uncertainty_can_estimate: row.uncertainty_can_estimate ?? null,
        complexity: row.complexity ?? null,
        complexity_can_estimate: row.complexity_can_estimate ?? null,
        effort: row.effort ?? null,
        effort_can_estimate: row.effort_can_estimate ?? null,
    }
}

function buildSessionRecord(
    row: SessionRow,
    tasks: TaskRef[],
    domains: Awaited<ReturnType<typeof loadDomainOptions>>,
): SessionRecord {
    const primaryTask = tasks[0] ?? null

    return {
        id: row.id,
        started_at: String(row.started_at ?? ''),
        ended_at: String(row.ended_at ?? ''),
        status: normalizeSessionStatus(row.status),
        aftermath_id: normalizeOptionalId(row.aftermath_id),
        project_id: normalizeOptionalId(row.project_id),
        tasks,
        task_title: primaryTask?.title ?? null,
        task_color: primaryTask ? resolveTaskColor(primaryTask, domains) : null,
    }
}

async function loadSessionTaskRows(projectId?: string | null): Promise<{
    sessionRows: SessionRow[]
    taskRows: SessionTaskRow[]
    domains: Awaited<ReturnType<typeof loadDomainOptions>>
}> {
    const db = await getDb()
    if (!db) {
        return { sessionRows: [], taskRows: [], domains: [] }
    }

    const sessionQuery = db
        .select({
            id: session.id,
            started_at: session.started_at,
            ended_at: session.ended_at,
            status: session.status,
            aftermath_id: session.aftermath_id,
            project_id: session.project_id,
        })
        .from(session)

    const [sessionRows, taskRows, domains] = await Promise.all([
        projectId != null
            ? sessionQuery.where(eq(session.project_id, projectId))
            : sessionQuery,
        db
            .select({
                session_id: sessionEdge.session_id,
                id: task.id,
                title: task.title,
                parent_task_id: task.parent_task_id,
                domain_id: task.domain_id,
                color: task.color,
                is_trophy: task.is_trophy,
                uncertainty: task.uncertainty,
                uncertainty_can_estimate: task.uncertainty_can_estimate,
                complexity: task.complexity,
                complexity_can_estimate: task.complexity_can_estimate,
                effort: task.effort,
                effort_can_estimate: task.effort_can_estimate,
            })
            .from(sessionEdge)
            .innerJoin(task, eq(sessionEdge.task_id, task.id)),
        loadDomainOptions(),
    ])

    return { sessionRows, taskRows, domains }
}

function groupTasksBySession(taskRows: SessionTaskRow[]): Map<string, TaskRef[]> {
    const grouped = new Map<string, TaskRef[]>()

    for (const row of taskRows) {
        const tasks = grouped.get(row.session_id) ?? []
        tasks.push(mapTaskRef(row))
        grouped.set(row.session_id, tasks)
    }

    for (const tasks of grouped.values()) {
        tasks.sort((left, right) => left.title.localeCompare(right.title))
    }

    return grouped
}

async function loadSessionRecords(projectId?: string | null): Promise<SessionRecord[]> {
    const { sessionRows, taskRows, domains } = await loadSessionTaskRows(projectId)
    const tasksBySession = groupTasksBySession(taskRows)

    return sessionRows.map((row) =>
        buildSessionRecord(row, tasksBySession.get(row.id) ?? [], domains),
    )
}

async function syncSessionTasks(sessionId: string, taskIds: string[]): Promise<void> {
    const db = await getDb()
    if (!db) {
        throw new Error('Database not initialized')
    }

    const normalizedTaskIds = uniqueTaskIds(taskIds)

    await db.delete(sessionEdge).where(eq(sessionEdge.session_id, sessionId))
    onSessionDataChanged()

    if (normalizedTaskIds.length === 0) return

    await db.insert(sessionEdge).values(
        normalizedTaskIds.map((taskId) => ({
            id: uuid(),
            session_id: sessionId,
            task_id: taskId,
        })),
    )
    onSessionDataChanged()
}

export async function loadSessions(projectId?: string | null): Promise<SessionRecord[]> {
    return loadSessionRecords(projectId)
}

export type TaskSessionTimeline = {
    lastSession: SessionRecord | null
    futureSessions: SessionRecord[]
}

function sessionLinksTask(record: SessionRecord, taskId: string): boolean {
    return record.tasks.some((entry) => entry.id === taskId)
}

export async function loadTaskSessionTimeline(
    taskId: string,
    now: Date = new Date(),
): Promise<TaskSessionTimeline> {
    const sessions = await loadSessionRecords()
    const linked = sessions.filter(
        (entry) =>
            sessionLinksTask(entry, taskId) &&
            entry.status !== SessionStatusCode.NoLongerNeeded,
    )

    const nowMs = now.getTime()

    const pastCompleted = linked
        .filter((entry) => {
            const end = parseSqlTimestamp(entry.ended_at)
            return end != null && end.getTime() <= nowMs
        })
        .sort((left, right) => {
            const leftEnd = parseSqlTimestamp(left.ended_at)?.getTime() ?? 0
            const rightEnd = parseSqlTimestamp(right.ended_at)?.getTime() ?? 0
            return rightEnd - leftEnd
        })

    const futureSessions = linked
        .filter((entry) => {
            const end = parseSqlTimestamp(entry.ended_at)
            return end != null && end.getTime() > nowMs
        })
        .sort((left, right) => {
            const leftStart = parseSqlTimestamp(left.started_at)?.getTime() ?? 0
            const rightStart = parseSqlTimestamp(right.started_at)?.getTime() ?? 0
            return leftStart - rightStart
        })

    return {
        lastSession: pastCompleted[0] ?? null,
        futureSessions,
    }
}

export function createSessionInputForTask(
    taskId: string,
    day: Date = new Date(),
    hour = 9,
): SessionInput {
    return {
        ...createDefaultSessionInput(day, hour),
        task_ids: [taskId],
    }
}

export async function loadDashboardSessions(projectId?: string | null): Promise<SessionRecord[]> {
    const sessions = await loadSessionRecords(projectId)
    return sessions.filter((entry) => entry.status !== SessionStatusCode.NoLongerNeeded)
}

export async function loadNonEvaluatedSessions(): Promise<SessionRecord[]> {
    const db = await getDb()
    if (!db) return []

    const [sessionRows, taskRows, domains] = await Promise.all([
        db
            .select({
                id: session.id,
                started_at: session.started_at,
                ended_at: session.ended_at,
                status: session.status,
                aftermath_id: session.aftermath_id,
            })
            .from(session)
            .where(
                and(
                    eq(session.status, SessionStatusCode.Finished),
                    isNull(session.aftermath_id),
                ),
            ),
        db
            .select({
                session_id: sessionEdge.session_id,
                id: task.id,
                title: task.title,
                parent_task_id: task.parent_task_id,
                domain_id: task.domain_id,
                color: task.color,
                is_trophy: task.is_trophy,
                uncertainty: task.uncertainty,
                uncertainty_can_estimate: task.uncertainty_can_estimate,
                complexity: task.complexity,
                complexity_can_estimate: task.complexity_can_estimate,
                effort: task.effort,
                effort_can_estimate: task.effort_can_estimate,
            })
            .from(sessionEdge)
            .innerJoin(task, eq(sessionEdge.task_id, task.id)),
        loadDomainOptions(),
    ])

    const tasksBySession = groupTasksBySession(taskRows)

    return sessionRows.map((row) =>
        buildSessionRecord(row, tasksBySession.get(row.id) ?? [], domains),
    )
}

export async function createSession(input: Omit<SessionInput, 'id'>): Promise<SessionRecord> {
    const db = await getDb()
    if (!db) {
        throw new Error('Database not initialized')
    }

    const id = uuid()
    const taskIds = uniqueTaskIds(input.task_ids)

    if (taskIds.length === 0) {
        throw new Error('At least one task is required')
    }

    const currentProjectId = getCurrentProjectId()

    await db.insert(session).values({
        id,
        started_at: input.started_at,
        ended_at: input.ended_at,
        status: input.status ?? SessionStatusCode.Planned,
        aftermath_id: input.aftermath_id ?? null,
        project_id: input.project_id !== undefined ? input.project_id : currentProjectId,
    })

    await syncSessionTasks(id, taskIds)

    const created = (await loadSessionRecords()).find((entry) => entry.id === id)
    if (!created) {
        throw new Error('Failed to load created session')
    }

    return created
}

export async function createAndStartSessionForTask(taskId: string): Promise<SessionRecord> {
    if (await taskHasChildren(taskId)) {
        throw new Error('This task has subtasks and cannot be started directly.')
    }

    const now = new Date()
    const created = await createSession(createSessionInputForTask(taskId, now, now.getHours()))
    await startSession(created.id, now)

    const started = (await loadSessionRecords()).find((entry) => entry.id === created.id)
    if (!started) {
        throw new Error('Failed to load started session')
    }

    return started
}

export async function updateSession(input: SessionInput): Promise<void> {
    const db = await getDb()
    if (!db) {
        throw new Error('Database not initialized')
    }

    if (!input.id) {
        throw new Error('Session id is required')
    }

    const taskIds = uniqueTaskIds(input.task_ids)
    if (taskIds.length === 0) {
        throw new Error('At least one task is required')
    }

    await db
        .update(session)
        .set({
            started_at: input.started_at,
            ended_at: input.ended_at,
            status: input.status ?? SessionStatusCode.Planned,
            aftermath_id: input.aftermath_id ?? null,
            project_id: input.project_id ?? null,
        })
        .where(eq(session.id, input.id))

    await syncSessionTasks(input.id, taskIds)
}

export async function updateSessionStatus(
    sessionId: string,
    status: SessionStatusCode,
    endedAt?: string,
): Promise<void> {
    const db = await getDb()
    if (!db) {
        throw new Error('Database not initialized')
    }

    const updates: {
        status: SessionStatusCode
        ended_at?: string
    } = { status }

    if (endedAt != null) {
        updates.ended_at = endedAt
    }

    await db.update(session).set(updates).where(eq(session.id, sessionId))
    onSessionDataChanged()
}

export async function startSession(
    sessionId: string,
    startedAt: Date = new Date(),
): Promise<void> {
    const db = await getDb()
    if (!db) {
        throw new Error('Database not initialized')
    }

    const rows = await db
        .select({
            started_at: session.started_at,
            ended_at: session.ended_at,
        })
        .from(session)
        .where(eq(session.id, sessionId))

    const row = rows[0]
    if (!row) {
        throw new Error('Session not found')
    }

    const plannedStart = parseSqlTimestamp(String(row.started_at ?? ''))
    const plannedEnd = parseSqlTimestamp(String(row.ended_at ?? ''))
    const started_at = formatSqlTimestamp(startedAt)
    let ended_at = String(row.ended_at ?? started_at)

    if (plannedStart && plannedEnd) {
        const durationMs = Math.max(
            plannedEnd.getTime() - plannedStart.getTime(),
            60_000,
        )

        if (plannedEnd <= startedAt) {
            ended_at = formatSqlTimestamp(new Date(startedAt.getTime() + durationMs))
        }
    }

    await db
        .update(session)
        .set({
            status: SessionStatusCode.Started,
            started_at,
            ended_at,
        })
        .where(eq(session.id, sessionId))
    onSessionDataChanged()
}

export async function finishSession(sessionId: string): Promise<SessionRecord> {
    const now = formatSqlTimestamp(new Date())
    await updateSessionStatus(sessionId, SessionStatusCode.Finished, now)

    const finished = (await loadSessionRecords()).find((entry) => entry.id === sessionId)
    if (!finished) {
        throw new Error('Failed to load finished session')
    }

    return finished
}

export async function markPlannedSessionsNoLongerNeededAfter(
    taskId: string,
    afterTime: string,
): Promise<void> {
    const db = await getDb()
    if (!db) {
        throw new Error('Database not initialized')
    }

    const edgeRows = await db
        .select({ session_id: sessionEdge.session_id })
        .from(sessionEdge)
        .where(eq(sessionEdge.task_id, taskId))

    const sessionIds = [...new Set(edgeRows.map((row) => row.session_id))]
    if (sessionIds.length === 0) return

    await db
        .update(session)
        .set({ status: SessionStatusCode.NoLongerNeeded })
        .where(
            and(
                inArray(session.id, sessionIds),
                eq(session.status, SessionStatusCode.Planned),
                gt(session.started_at, afterTime),
            ),
        )
    onSessionDataChanged()
}

/** @deprecated Use markPlannedSessionsNoLongerNeededAfter */
export async function deletePlannedSessionsAfter(
    taskId: string,
    afterTime: string,
): Promise<void> {
    await markPlannedSessionsNoLongerNeededAfter(taskId, afterTime)
}

export async function deleteSession(sessionId: string): Promise<void> {
    const db = await getDb()
    if (!db) {
        throw new Error('Database not initialized')
    }

    await db.delete(session).where(eq(session.id, sessionId))
    onSessionDataChanged()
}

export function createDefaultSessionInput(day: Date, hour = 9): SessionInput {
    const start = new Date(day)
    start.setHours(hour, 0, 0, 0)

    const end = new Date(start)
    end.setHours(hour + 1, 0, 0, 0)

    return {
        started_at: formatSqlTimestamp(start),
        ended_at: formatSqlTimestamp(end),
        status: SessionStatusCode.Planned,
        task_ids: [],
        aftermath_id: null,
        project_id: getCurrentProjectId(),
    }
}

export function sessionToInput(session: SessionRecord): SessionInput {
    return {
        id: session.id,
        started_at: session.started_at,
        ended_at: session.ended_at,
        status: session.status,
        task_ids: session.tasks.map((task) => task.id),
        aftermath_id: session.aftermath_id,
        project_id: session.project_id,
    }
}
