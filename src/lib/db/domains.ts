import { eq, asc } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'

import { getDb } from '$lib/db'
import { domain, task } from '$lib/db/schema'
import { projectScopeCondition } from '$lib/db/projectScope'
import { getCurrentProjectId } from '$lib/projectState.svelte'
import type { DomainOption } from '$lib/db/dataView'

export const UNASSIGNED_DOMAIN_ID = '__unassigned__'

export type DomainRecord = {
    id: string
    name: string
    description: string | null
    color: number | null
    icon: string | null
    parent_domain_id: string | null
    project_id: string | null
}

export function recordToDomain(record: Record<string, unknown>): DomainRecord {
    return {
        id: String(record.id ?? ''),
        name: String(record.name ?? ''),
        description: record.description == null ? null : String(record.description),
        color: record.color == null ? null : Number(record.color),
        icon: record.icon == null ? null : String(record.icon),
        parent_domain_id:
            record.parent_domain_id == null || record.parent_domain_id === ''
                ? null
                : String(record.parent_domain_id),
        project_id:
            record.project_id == null || record.project_id === ''
                ? null
                : String(record.project_id),
    }
}

export function domainToOption(record: DomainRecord): DomainOption {
    return {
        id: record.id,
        title: record.name,
        color: record.color,
        parent_domain_id: record.parent_domain_id,
        icon: record.icon,
    }
}

export async function loadDomains(projectId?: string | null): Promise<DomainRecord[]> {
    const db = await getDb()
    if (!db) return []

    const scope = projectScopeCondition(domain.project_id, projectId ?? null)
    const rows = scope
        ? await db.select().from(domain).where(scope).orderBy(asc(domain.name))
        : await db.select().from(domain).orderBy(asc(domain.name))

    return rows.map((row) => recordToDomain(row as Record<string, unknown>))
}

export async function loadDomainById(id: string): Promise<DomainRecord | null> {
    const db = await getDb()
    if (!db) return null

    const rows = await db.select().from(domain).where(eq(domain.id, id)).limit(1)
    const row = rows[0]
    if (!row) return null

    return recordToDomain(row as Record<string, unknown>)
}

export async function createDomain(input: {
    name?: string
    description?: string | null
    color?: number | null
    icon?: string | null
    parent_domain_id?: string | null
} = {}): Promise<DomainRecord> {
    const db = await getDb()
    if (!db) throw new Error('Database not initialized')

    const id = uuid()
    const currentProjectId = getCurrentProjectId()

    await db.insert(domain).values({
        id,
        name: input.name?.trim() || 'New domain',
        description: input.description ?? null,
        color: input.color ?? null,
        icon: input.icon ?? null,
        parent_domain_id: input.parent_domain_id ?? null,
        project_id: currentProjectId,
    })

    const created = await loadDomainById(id)
    if (!created) throw new Error('Failed to load created domain')
    return created
}

export async function updateDomain(
    id: string,
    patch: Partial<
        Pick<
            DomainRecord,
            'name' | 'description' | 'color' | 'icon' | 'parent_domain_id' | 'project_id'
        >
    >,
): Promise<void> {
    const db = await getDb()
    if (!db) throw new Error('Database not initialized')

    if (patch.parent_domain_id !== undefined && patch.parent_domain_id !== null) {
        if (patch.parent_domain_id === id) {
            throw new Error('A domain cannot be its own parent')
        }
        const all = await loadDomains()
        if (wouldCreateDomainCycle(id, patch.parent_domain_id, all)) {
            throw new Error('That parent would create a cycle in the domain hierarchy')
        }
    }

    const updates: Partial<typeof domain.$inferInsert> = {}
    if (patch.name !== undefined) updates.name = patch.name.trim() || 'Untitled domain'
    if (patch.description !== undefined) updates.description = patch.description
    if (patch.color !== undefined) updates.color = patch.color
    if (patch.icon !== undefined) updates.icon = patch.icon
    if (patch.parent_domain_id !== undefined) {
        updates.parent_domain_id = patch.parent_domain_id
    }
    if (patch.project_id !== undefined) {
        updates.project_id = patch.project_id
    }

    if (Object.keys(updates).length === 0) return

    await db.update(domain).set(updates).where(eq(domain.id, id))
}

export async function deleteDomain(id: string): Promise<void> {
    const db = await getDb()
    if (!db) throw new Error('Database not initialized')

    await db.update(domain).set({ parent_domain_id: null }).where(eq(domain.parent_domain_id, id))
    await db.update(task).set({ domain_id: null }).where(eq(task.domain_id, id))
    await db.delete(domain).where(eq(domain.id, id))
}

export async function moveTaskToDomain(
    taskId: string,
    domainId: string | null,
): Promise<void> {
    const db = await getDb()
    if (!db) throw new Error('Database not initialized')

    await db
        .update(task)
        .set({ domain_id: domainId })
        .where(eq(task.id, taskId))
}

export function wouldCreateDomainCycle(
    domainId: string,
    parentId: string,
    domains: Pick<DomainRecord, 'id' | 'parent_domain_id'>[],
): boolean {
    const byId = new Map(domains.map((entry) => [entry.id, entry]))
    let currentId: string | null = parentId
    const visited = new Set<string>()

    while (currentId && !visited.has(currentId)) {
        if (currentId === domainId) return true
        visited.add(currentId)
        currentId = byId.get(currentId)?.parent_domain_id ?? null
    }

    return false
}

export function collectDomainDescendantIds(
    domainId: string,
    domains: Pick<DomainOption, 'id' | 'parent_domain_id'>[],
): Set<string> {
    const descendants = new Set<string>()
    const queue = [domainId]

    while (queue.length > 0) {
        const currentId = queue.pop()!
        for (const entry of domains) {
            if (entry.parent_domain_id === currentId && !descendants.has(entry.id)) {
                descendants.add(entry.id)
                queue.push(entry.id)
            }
        }
    }

    return descendants
}
