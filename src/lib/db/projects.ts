import { eq, isNull, sql } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'

import { getDb } from '$lib/db'
import { project, task, session, taskStatus, domain, aftermath, kanbanGraphPosition } from '$lib/db/schema'
import { loadSessionTimeIndex } from '$lib/trophy/trophyTime'

export type ProjectRecord = {
    id: string
    name: string
    description: string | null
    color: number | null
    icon: string | null
    created_at: string | null
    updated_at: string | null
}

export type ProjectMetrics = ProjectRecord & {
    task_count: number
    trophy_count: number
    done_task_count: number
    total_effort: number | null
    total_complexity: number | null
    total_uncertainty: number | null
    time_spent_ms: number
}

export type ProjectRef = Pick<ProjectRecord, 'id' | 'name' | 'description' | 'color' | 'icon'>

export async function loadProjectOptions(): Promise<ProjectRef[]> {
    return (await loadProjects()).map(({ id, name, description, color, icon }) => ({
        id,
        name,
        description,
        color,
        icon,
    }))
}

export async function loadProjectMetricsById(id: string): Promise<ProjectMetrics | null> {
    const metrics = await loadProjectMetrics()
    return metrics.find((entry) => entry.id === id) ?? null
}

export async function loadProjects(): Promise<ProjectRecord[]> {
    const db = await getDb()
    if (!db) return []

    const rows = await db.select().from(project).orderBy(project.name)
    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description ?? null,
        color: row.color ?? null,
        icon: row.icon ?? null,
        created_at: row.created_at ?? null,
        updated_at: row.updated_at ?? null,
    }))
}

export async function loadProjectById(id: string): Promise<ProjectRecord | null> {
    const db = await getDb()
    if (!db) return null

    const rows = await db.select().from(project).where(eq(project.id, id)).limit(1)
    const row = rows[0]
    if (!row) return null

    return {
        id: row.id,
        name: row.name,
        description: row.description ?? null,
        color: row.color ?? null,
        icon: row.icon ?? null,
        created_at: row.created_at ?? null,
        updated_at: row.updated_at ?? null,
    }
}

export async function createProject(input: {
    name: string
    description?: string | null
    color?: number | null
    icon?: string | null
}): Promise<ProjectRecord> {
    const db = await getDb()
    if (!db) throw new Error('Database not initialized')

    const id = uuid()
    await db.insert(project).values({
        id,
        name: input.name,
        description: input.description ?? null,
        color: input.color ?? null,
        icon: input.icon ?? null,
    })

    const created = await loadProjectById(id)
    if (!created) throw new Error('Failed to load created project')
    return created
}

export async function updateProject(
    id: string,
    patch: Partial<Pick<ProjectRecord, 'name' | 'description' | 'color' | 'icon'>>,
): Promise<void> {
    const db = await getDb()
    if (!db) throw new Error('Database not initialized')

    const updates: Partial<typeof project.$inferInsert> = {}
    if (patch.name !== undefined) updates.name = patch.name
    if (patch.description !== undefined) updates.description = patch.description
    if (patch.color !== undefined) updates.color = patch.color
    if (patch.icon !== undefined) updates.icon = patch.icon

    if (Object.keys(updates).length === 0) return

    await db.update(project).set(updates).where(eq(project.id, id))
}

export async function deleteProject(id: string): Promise<void> {
    const db = await getDb()
    if (!db) throw new Error('Database not initialized')

    await db.update(task).set({ project_id: null }).where(eq(task.project_id, id))
    await db.update(session).set({ project_id: null }).where(eq(session.project_id, id))
    await db.update(domain).set({ project_id: null }).where(eq(domain.project_id, id))
    await db.update(aftermath).set({ project_id: null }).where(eq(aftermath.project_id, id))
    await db.update(taskStatus).set({ project_id: null }).where(eq(taskStatus.project_id, id))
    await db
        .delete(kanbanGraphPosition)
        .where(eq(kanbanGraphPosition.project_id, id))
    await db.delete(project).where(eq(project.id, id))
}

export async function loadProjectMetrics(): Promise<ProjectMetrics[]> {
    const db = await getDb()
    if (!db) return []

    const projects = await loadProjects()
    const sessionTime = await loadSessionTimeIndex()

    const metrics = await Promise.all(
        projects.map(async (proj) => {
            const tasks = await db
                .select({
                    id: task.id,
                    is_trophy: task.is_trophy,
                    task_status_id: task.task_status_id,
                    effort: task.effort,
                    effort_can_estimate: task.effort_can_estimate,
                    complexity: task.complexity,
                    complexity_can_estimate: task.complexity_can_estimate,
                    uncertainty: task.uncertainty,
                    uncertainty_can_estimate: task.uncertainty_can_estimate,
                })
                .from(task)
                .where(eq(task.project_id, proj.id))

            const terminalStatuses = await db
                .select({ id: taskStatus.id })
                .from(taskStatus)
                .where(eq(taskStatus.is_terminal, true))

            const terminalIds = new Set(terminalStatuses.map((s) => s.id))

            const task_count = tasks.length
            const trophy_count = tasks.filter((t) => t.is_trophy).length
            const done_task_count = tasks.filter(
                (t) => t.task_status_id != null && terminalIds.has(t.task_status_id),
            ).length
            let total_effort = 0
            let has_effort = false
            let total_complexity = 0
            let has_complexity = false
            let total_uncertainty = 0
            let has_uncertainty = false

            for (const t of tasks) {
                if (t.uncertainty_can_estimate === 1 && t.uncertainty != null) {
                    total_uncertainty += t.uncertainty
                    has_uncertainty = true
                }
                if (t.complexity_can_estimate === 1 && t.complexity != null) {
                    total_complexity += t.complexity
                    has_complexity = true
                }
                if (t.effort_can_estimate === 1 && t.effort != null) {
                    total_effort += t.effort
                    has_effort = true
                }
            }

            const sessionIndices = new Set<number>()
            for (const taskRow of tasks) {
                const indices = sessionTime.taskToSessions.get(taskRow.id)
                if (!indices) continue
                for (const index of indices) sessionIndices.add(index)
            }
            let time_spent_ms = 0
            for (const index of sessionIndices) {
                time_spent_ms += sessionTime.durations[index] ?? 0
            }

            return {
                ...proj,
                task_count,
                trophy_count,
                done_task_count,
                total_effort: has_effort ? total_effort : null,
                total_complexity: has_complexity ? total_complexity : null,
                total_uncertainty: has_uncertainty ? total_uncertainty : null,
                time_spent_ms,
            }
        }),
    )

    return metrics
}

export async function loadKanbanGraphPositions(
    projectId: string | null,
): Promise<Map<string, { pos_x: number; pos_y: number }>> {
    const db = await getDb()
    if (!db) return new Map()

    const rows = projectId == null
        ? await db
              .select()
              .from(kanbanGraphPosition)
              .where(isNull(kanbanGraphPosition.project_id))
        : await db
              .select()
              .from(kanbanGraphPosition)
              .where(eq(kanbanGraphPosition.project_id, projectId))

    const map = new Map<string, { pos_x: number; pos_y: number }>()
    for (const row of rows) {
        map.set(row.task_status_id, { pos_x: row.pos_x, pos_y: row.pos_y })
    }
    return map
}

export async function upsertKanbanGraphPosition(
    projectId: string | null,
    taskStatusId: string,
    pos_x: number,
    pos_y: number,
): Promise<void> {
    const db = await getDb()
    if (!db) throw new Error('Database not initialized')

    const existing = projectId == null
        ? await db
              .select({ id: kanbanGraphPosition.id })
              .from(kanbanGraphPosition)
              .where(
                  sql`${kanbanGraphPosition.project_id} IS NULL AND ${kanbanGraphPosition.task_status_id} = ${taskStatusId}`,
              )
              .limit(1)
        : await db
              .select({ id: kanbanGraphPosition.id })
              .from(kanbanGraphPosition)
              .where(
                  sql`${kanbanGraphPosition.project_id} = ${projectId} AND ${kanbanGraphPosition.task_status_id} = ${taskStatusId}`,
              )
              .limit(1)

    if (existing.length > 0) {
        await db
            .update(kanbanGraphPosition)
            .set({ pos_x, pos_y })
            .where(eq(kanbanGraphPosition.id, existing[0].id))
    } else {
        await db.insert(kanbanGraphPosition).values({
            id: uuid(),
            project_id: projectId,
            task_status_id: taskStatusId,
            pos_x,
            pos_y,
        })
    }
}
