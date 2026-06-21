import { desc, eq, inArray, isNull, or } from 'drizzle-orm'

import { getDb } from '$lib/db'
import { loadDomainOptions } from '$lib/db/dataView'
import { SessionStatusCode } from '$lib/db/sessionStatus'
import { domain, session, sessionEdge, task, taskStatus } from '$lib/db/schema'
import { parseSqlTimestamp } from '$lib/calendar/dates'

export type DomainActivitySummary = {
    domainId: string | null
    domainName: string
    sessionCount: number
    totalMinutes: number
    lastSessionEndedAt: string | null
}

export type RecommendationContext = {
    domains: Array<{
        id: string
        name: string
        description: string | null
        parentDomainId: string | null
    }>
    recentDomainActivity: DomainActivitySummary[]
    recentSessions: Array<{
        id: string
        startedAt: string
        endedAt: string
        status: number
        taskTitles: string[]
        domainNames: string[]
    }>
    openTaskCount: number
}

function sessionDurationMinutes(startedAt: string, endedAt: string): number {
    const start = parseSqlTimestamp(startedAt)
    const end = parseSqlTimestamp(endedAt)
    if (!start || !end) return 0
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000))
}

export async function buildRecommendationContext(
    lookbackDays = 60,
): Promise<RecommendationContext> {
    const db = await getDb()
    if (!db) {
        return {
            domains: [],
            recentDomainActivity: [],
            recentSessions: [],
            openTaskCount: 0,
        }
    }

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - lookbackDays)
    const cutoffIso = cutoff.toISOString()

    const [domains, sessionRows, sessionTaskRows, openTaskRows] = await Promise.all([
        loadDomainOptions(),
        db
            .select({
                id: session.id,
                started_at: session.started_at,
                ended_at: session.ended_at,
                status: session.status,
            })
            .from(session)
            .where(eq(session.status, SessionStatusCode.Finished))
            .orderBy(desc(session.ended_at)),
        db
            .select({
                session_id: sessionEdge.session_id,
                task_title: task.title,
                domain_id: task.domain_id,
            })
            .from(sessionEdge)
            .innerJoin(task, eq(sessionEdge.task_id, task.id)),
        db
            .select({ id: task.id })
            .from(task)
            .leftJoin(taskStatus, eq(task.task_status_id, taskStatus.id))
            .where(or(isNull(taskStatus.is_terminal), eq(taskStatus.is_terminal, 0))),
    ])

    const domainNameById = new Map(domains.map((entry) => [entry.id, entry.title]))
    const tasksBySession = new Map<string, Array<{ title: string; domainId: string | null }>>()

    for (const row of sessionTaskRows) {
        const list = tasksBySession.get(row.session_id) ?? []
        list.push({
            title: row.task_title ?? 'Untitled task',
            domainId: row.domain_id ?? null,
        })
        tasksBySession.set(row.session_id, list)
    }

    const activityByDomain = new Map<string, DomainActivitySummary>()

    const recentSessions = sessionRows
        .filter((row) => {
            const endedAt = String(row.ended_at ?? '')
            const end = parseSqlTimestamp(endedAt)
            return end != null && end.toISOString() >= cutoffIso
        })
        .slice(0, 30)
        .map((row) => {
            const linkedTasks = tasksBySession.get(row.id) ?? []
            const domainNames = [
                ...new Set(
                    linkedTasks
                        .map((entry) =>
                            entry.domainId ? domainNameById.get(entry.domainId) ?? null : null,
                        )
                        .filter((name): name is string => Boolean(name)),
                ),
            ]

            for (const linkedTask of linkedTasks) {
                const key = linkedTask.domainId ?? '__none__'
                const existing = activityByDomain.get(key) ?? {
                    domainId: linkedTask.domainId,
                    domainName: linkedTask.domainId
                        ? domainNameById.get(linkedTask.domainId) ?? 'Unknown domain'
                        : 'No domain',
                    sessionCount: 0,
                    totalMinutes: 0,
                    lastSessionEndedAt: null,
                }

                existing.sessionCount += 1
                existing.totalMinutes += sessionDurationMinutes(
                    String(row.started_at ?? ''),
                    String(row.ended_at ?? ''),
                )

                const endedAt = String(row.ended_at ?? '')
                if (
                    !existing.lastSessionEndedAt ||
                    endedAt > existing.lastSessionEndedAt
                ) {
                    existing.lastSessionEndedAt = endedAt
                }

                activityByDomain.set(key, existing)
            }

            return {
                id: row.id,
                startedAt: String(row.started_at ?? ''),
                endedAt: String(row.ended_at ?? ''),
                status: row.status ?? SessionStatusCode.Finished,
                taskTitles: linkedTasks.map((entry) => entry.title),
                domainNames,
            }
        })

    const recentDomainActivity = [...activityByDomain.values()].sort(
        (left, right) => right.totalMinutes - left.totalMinutes,
    )

    const domainDescriptions = await db
        .select({
            id: domain.id,
            name: domain.name,
            description: domain.description,
            parent_domain_id: domain.parent_domain_id,
        })
        .from(domain)

    return {
        domains: domainDescriptions.map((row) => ({
            id: row.id,
            name: row.name,
            description: row.description ?? null,
            parentDomainId: row.parent_domain_id ?? null,
        })),
        recentDomainActivity,
        recentSessions,
        openTaskCount: openTaskRows.length,
    }
}

export function formatContextForPrompt(context: RecommendationContext): string {
    const domainLines = context.domains
        .map((entry) => {
            const parent = entry.parentDomainId ? ` (parent: ${entry.parentDomainId})` : ''
            const description = entry.description ? ` — ${entry.description}` : ''
            return `- ${entry.name} [${entry.id}]${parent}${description}`
        })
        .join('\n')

    const activityLines =
        context.recentDomainActivity.length === 0
            ? '- No finished sessions in lookback window.'
            : context.recentDomainActivity
                  .map(
                      (entry) =>
                          `- ${entry.domainName}: ${entry.sessionCount} sessions, ~${entry.totalMinutes} min, last ended ${entry.lastSessionEndedAt ?? 'unknown'}`,
                  )
                  .join('\n')

    const sessionLines =
        context.recentSessions.length === 0
            ? '- No recent finished sessions.'
            : context.recentSessions
                  .slice(0, 12)
                  .map(
                      (entry) =>
                          `- ${entry.endedAt}: ${entry.taskTitles.join(', ') || 'Untitled'} (${entry.domainNames.join(', ') || 'no domain'})`,
                  )
                  .join('\n')

    return `
Available domains:
${domainLines || '- none'}

Recent domain activity (most time first):
${activityLines}

Recent finished sessions:
${sessionLines}

Open non-terminal tasks: ${context.openTaskCount}
`.trim()
}

export async function loadTasksByIds(taskIds: string[]) {
    const db = await getDb()
    if (!db || taskIds.length === 0) return []

    const uniqueIds = [...new Set(taskIds)]
    const [rows, domains] = await Promise.all([
        db
            .select({
                id: task.id,
                title: task.title,
                domain_id: task.domain_id,
                complexity: task.complexity,
                effort: task.effort,
            })
            .from(task)
            .where(inArray(task.id, uniqueIds)),
        loadDomainOptions(),
    ])

    const domainNameById = new Map(domains.map((entry) => [entry.id, entry.title]))

    return rows.map((row) => ({
        id: row.id,
        title: row.title,
        domainName: row.domain_id ? domainNameById.get(row.domain_id) ?? null : null,
        complexity: row.complexity,
        effort: row.effort,
    }))
}
