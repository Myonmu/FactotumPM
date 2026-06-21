import {
    fetchTableRows,
    loadDomainOptions,
    recordToTask,
    type DomainOption,
    type TaskRecord,
} from '$lib/db/dataView'
import { loadSessionTimeIndex, type SessionTimeIndex } from '$lib/trophy/trophyTime'

/**
 * Shared, reactive accumulated "time spent" for tasks and domains, derived from
 * the session timing index. Task renderers read it by id (no prop drilling) via
 * {@link getTaskTimeMs} / {@link getDomainTimeMs}, which are reactive: reassigning
 * the maps re-renders any card showing a time.
 *
 * - Task time = distinct session durations across the task's subtree (the task
 *   plus all descendant tasks).
 * - Domain time = distinct session durations across every task assigned to that
 *   domain or any descendant domain.
 */

let taskTimeById = $state(new Map<string, number>())
let domainTimeById = $state(new Map<string, number>())
let loaded = $state(false)
let inflight: Promise<void> | null = null

function computeTaskTimeMap(
    tasks: TaskRecord[],
    index: SessionTimeIndex,
): Map<string, number> {
    const byId = new Map<string, TaskRecord>()
    const childrenByParent = new Map<string, TaskRecord[]>()
    for (const task of tasks) byId.set(task.id, task)
    for (const task of tasks) {
        if (task.parent_task_id && byId.has(task.parent_task_id)) {
            const siblings = childrenByParent.get(task.parent_task_id) ?? []
            siblings.push(task)
            childrenByParent.set(task.parent_task_id, siblings)
        }
    }

    const setMemo = new Map<string, Set<number>>()

    function subtreeSessions(taskId: string): Set<number> {
        const memoized = setMemo.get(taskId)
        if (memoized) return memoized

        const set = new Set<number>(index.taskToSessions.get(taskId) ?? [])
        setMemo.set(taskId, set)

        for (const child of childrenByParent.get(taskId) ?? []) {
            if (child.id === taskId) continue
            for (const sessionIndex of subtreeSessions(child.id)) set.add(sessionIndex)
        }
        return set
    }

    const result = new Map<string, number>()
    for (const task of tasks) {
        let ms = 0
        for (const sessionIndex of subtreeSessions(task.id)) {
            ms += index.durations[sessionIndex] ?? 0
        }
        result.set(task.id, ms)
    }
    return result
}

function computeDomainTimeMap(
    tasks: TaskRecord[],
    domains: DomainOption[],
    index: SessionTimeIndex,
): Map<string, number> {
    // Direct sessions contributed by each domain's own tasks.
    const directByDomain = new Map<string, Set<number>>()
    for (const task of tasks) {
        if (!task.domain_id) continue
        const sessions = index.taskToSessions.get(task.id)
        if (!sessions) continue
        const set = directByDomain.get(task.domain_id) ?? new Set<number>()
        for (const sessionIndex of sessions) set.add(sessionIndex)
        directByDomain.set(task.domain_id, set)
    }

    const childrenByParent = new Map<string, DomainOption[]>()
    for (const domain of domains) {
        const parentId = domain.parent_domain_id ?? null
        if (!parentId) continue
        const siblings = childrenByParent.get(parentId) ?? []
        siblings.push(domain)
        childrenByParent.set(parentId, siblings)
    }

    const setMemo = new Map<string, Set<number>>()

    function subtreeSessions(domainId: string): Set<number> {
        const memoized = setMemo.get(domainId)
        if (memoized) return memoized

        const set = new Set<number>(directByDomain.get(domainId) ?? [])
        setMemo.set(domainId, set)

        for (const child of childrenByParent.get(domainId) ?? []) {
            if (child.id === domainId) continue
            for (const sessionIndex of subtreeSessions(child.id)) set.add(sessionIndex)
        }
        return set
    }

    const result = new Map<string, number>()
    for (const domain of domains) {
        let ms = 0
        for (const sessionIndex of subtreeSessions(domain.id)) {
            ms += index.durations[sessionIndex] ?? 0
        }
        result.set(domain.id, ms)
    }
    return result
}

export async function refreshSessionTimeMaps(force = false): Promise<void> {
    if (inflight) return inflight

    inflight = (async () => {
        try {
            const [taskResult, domains, index] = await Promise.all([
                fetchTableRows('task'),
                loadDomainOptions(),
                loadSessionTimeIndex({ force }),
            ])
            const tasks = taskResult.rows.map(recordToTask)
            taskTimeById = computeTaskTimeMap(tasks, index)
            domainTimeById = computeDomainTimeMap(tasks, domains, index)
            loaded = true
        } catch {
            // Leave existing values in place; callers fall back to 0.
        } finally {
            inflight = null
        }
    })()

    return inflight
}

export async function ensureSessionTimeMaps(): Promise<void> {
    if (loaded) return
    await refreshSessionTimeMaps()
}

/** Recompute live when sessions change; no-op until first load is requested. */
export function markSessionTimeStale(): void {
    if (loaded) {
        void refreshSessionTimeMaps(true)
    }
}

export function getTaskTimeMs(taskId: string): number {
    return taskTimeById.get(taskId) ?? 0
}

export function getDomainTimeMs(domainId: string): number {
    return domainTimeById.get(domainId) ?? 0
}
