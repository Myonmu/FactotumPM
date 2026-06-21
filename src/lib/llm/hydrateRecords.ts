import { inArray } from 'drizzle-orm'

import { getDb } from '$lib/db'
import type { AftermathRecord } from '$lib/db/aftermath'
import type { DomainOption, TaskRef } from '$lib/db/dataView'
import { loadDomainOptions } from '$lib/db/dataView'
import { loadSessions, type SessionRecord } from '$lib/db/sessions'
import { aftermath, task, taskStatus } from '$lib/db/schema'
import type { TaskStatusRecord } from '$lib/db/taskStatusMachine'

import type { FactotumViewType } from './types'
import { extractEntityIds } from './viewIdEnforcement'

function orderByIds<T extends { id: string }>(items: T[], ids: string[]): T[] {
    if (ids.length === 0) return items

    const byId = new Map(items.map((item) => [item.id, item]))
    return ids.map((id) => byId.get(id)).filter((item): item is T => item != null)
}

export async function hydrateTaskRefsByIds(ids: string[]): Promise<TaskRef[]> {
    if (ids.length === 0) return []

    const db = await getDb()
    if (!db) return []

    const rows = await db
        .select({
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
        .from(task)
        .where(inArray(task.id, ids))

    const refs = rows.map((row) => ({
        id: row.id,
        title: row.title,
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
    }))

    return orderByIds(refs, ids)
}

export async function hydrateSessionsByIds(ids: string[]): Promise<SessionRecord[]> {
    if (ids.length === 0) return []

    const sessions = await loadSessions()
    return orderByIds(sessions, ids)
}

export async function hydrateDomainsByIds(ids: string[]): Promise<DomainOption[]> {
    if (ids.length === 0) return []

    const domains = await loadDomainOptions()
    return orderByIds(domains, ids)
}

export async function hydrateAftermathsByIds(ids: string[]): Promise<AftermathRecord[]> {
    if (ids.length === 0) return []

    const db = await getDb()
    if (!db) return []

    const rows = await db.select().from(aftermath).where(inArray(aftermath.id, ids))
    const mapped = rows.map((row) => ({
        id: row.id,
        score: row.score ?? null,
        description: row.description ?? null,
        icon: row.icon ?? null,
        color: row.color ?? null,
    }))

    return orderByIds(mapped, ids)
}

export async function hydrateTaskStatusesByIds(ids: string[]): Promise<TaskStatusRecord[]> {
    if (ids.length === 0) return []

    const db = await getDb()
    if (!db) return []

    const rows = await db.select().from(taskStatus).where(inArray(taskStatus.id, ids))
    const mapped = rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description ?? null,
        pos_x: row.pos_x ?? 0,
        pos_y: row.pos_y ?? 0,
        kanban_pos_x: row.kanban_pos_x ?? 0,
        kanban_pos_y: row.kanban_pos_y ?? 0,
        is_initial: row.is_initial ?? null,
        is_terminal: row.is_terminal ?? null,
        color: row.color ?? null,
    }))

    return orderByIds(mapped, ids)
}

export async function hydrateByViewType(
    viewType: FactotumViewType,
    ids: string[],
): Promise<
    | { kind: 'task'; items: TaskRef[] }
    | { kind: 'session'; items: SessionRecord[] }
    | { kind: 'domain'; items: DomainOption[] }
    | { kind: 'aftermath'; items: AftermathRecord[] }
    | { kind: 'task_status'; items: TaskStatusRecord[] }
    | { kind: 'table'; items: [] }
> {
    switch (viewType) {
        case 'task':
            return { kind: 'task', items: await hydrateTaskRefsByIds(ids) }
        case 'session':
            return { kind: 'session', items: await hydrateSessionsByIds(ids) }
        case 'domain':
            return { kind: 'domain', items: await hydrateDomainsByIds(ids) }
        case 'aftermath':
            return { kind: 'aftermath', items: await hydrateAftermathsByIds(ids) }
        case 'task_status':
            return { kind: 'task_status', items: await hydrateTaskStatusesByIds(ids) }
        default:
            return { kind: 'table', items: [] }
    }
}

/** @deprecated Use hydrateTaskRefsByIds */
export async function hydrateTaskRefs(records: Record<string, unknown>[]): Promise<TaskRef[]> {
    return hydrateTaskRefsByIds(extractEntityIds(records, 'task'))
}

export async function hydrateSessions(records: Record<string, unknown>[]): Promise<SessionRecord[]> {
    return hydrateSessionsByIds(extractEntityIds(records, 'session'))
}

export async function hydrateDomains(records: Record<string, unknown>[]): Promise<DomainOption[]> {
    return hydrateDomainsByIds(extractEntityIds(records, 'domain'))
}

export async function hydrateAftermaths(
    records: Record<string, unknown>[],
): Promise<AftermathRecord[]> {
    return hydrateAftermathsByIds(extractEntityIds(records, 'aftermath'))
}

export async function hydrateTaskStatuses(
    records: Record<string, unknown>[],
): Promise<TaskStatusRecord[]> {
    return hydrateTaskStatusesByIds(extractEntityIds(records, 'task_status'))
}
