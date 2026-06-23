import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm'

import { getDb } from '$lib/db'
import { loadDomainOptions } from '$lib/db/dataView'
import { projectScopeCondition } from '$lib/db/projectScope'
import { SessionStatusCode } from '$lib/db/sessionStatus'
import { domain, session, sessionEdge, task, taskStatus } from '$lib/db/schema'
import { getCurrentProject, getCurrentProjectId } from '$lib/projectState.svelte'
import { parseSqlTimestamp } from '$lib/calendar/dates'

export type DomainActivitySummary = {
    domainId: string | null
    domainName: string
    sessionCount: number
    totalMinutes: number
    lastSessionEndedAt: string | null
}

export type RecommendationContext = {
    currentProject: {
        id: string
        name: string
    } | null
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
    const projectId = getCurrentProjectId()
    const currentProjectRecord = getCurrentProject()
    const currentProject = currentProjectRecord
        ? { id: currentProjectRecord.id, name: currentProjectRecord.name }
        : null

    if (!db) {
        return {
            currentProject,
            domains: [],
            recentDomainActivity: [],
            recentSessions: [],
            openTaskCount: 0,
        }
    }

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - lookbackDays)
    const cutoffIso = cutoff.toISOString()

    const sessionStatusFilter = eq(session.status, SessionStatusCode.Finished)
    const sessionProjectScope = projectScopeCondition(session.project_id, projectId)
    const sessionWhere =
        sessionProjectScope != null
            ? and(sessionStatusFilter, sessionProjectScope)
            : sessionStatusFilter

    const openTaskStatusFilter = or(
        isNull(taskStatus.is_terminal),
        eq(taskStatus.is_terminal, false),
    )
    const taskProjectScope = projectScopeCondition(task.project_id, projectId)
    const openTaskWhere =
        taskProjectScope != null
            ? and(openTaskStatusFilter, taskProjectScope)
            : openTaskStatusFilter

    const sessionTaskQuery = db
        .select({
            session_id: sessionEdge.session_id,
            task_title: task.title,
            domain_id: task.domain_id,
        })
        .from(sessionEdge)
        .innerJoin(task, eq(sessionEdge.task_id, task.id))

    const [domains, sessionRows, sessionTaskRows, openTaskRows, domainDescriptions] =
        await Promise.all([
            loadDomainOptions(projectId),
            db
                .select({
                    id: session.id,
                    started_at: session.started_at,
                    ended_at: session.ended_at,
                    status: session.status,
                })
                .from(session)
                .where(sessionWhere)
                .orderBy(desc(session.ended_at)),
            taskProjectScope != null
                ? sessionTaskQuery.where(taskProjectScope)
                : sessionTaskQuery,
            db.select({ id: task.id }).from(task).leftJoin(
                taskStatus,
                eq(task.task_status_id, taskStatus.id),
            ).where(openTaskWhere),
            (async () => {
                const domainQuery = db
                    .select({
                        id: domain.id,
                        name: domain.name,
                        description: domain.description,
                        parent_domain_id: domain.parent_domain_id,
                    })
                    .from(domain)
                const domainProjectScope = projectScopeCondition(domain.project_id, projectId)
                return domainProjectScope != null
                    ? domainQuery.where(domainProjectScope)
                    : domainQuery
            })(),
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

    return {
        currentProject,
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
    const projectLines = context.currentProject
        ? `Current project: ${context.currentProject.name} [${context.currentProject.id}]
Scope: domains, sessions, and task counts below include only this project plus items with no project assigned.`
        : `Current project: All projects (no project filter applied)`

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
${projectLines}

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
    const projectId = getCurrentProjectId()
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
        loadDomainOptions(projectId),
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
