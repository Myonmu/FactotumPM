import { invoke } from '@tauri-apps/api/core'
import { and, eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'

import { getDb } from '$lib/db'
import { taskStatus, taskStatusEdge } from '$lib/db/schema'
import { getStatusEdgeColorHex } from '$lib/statusMachine/edgeColor'
import { loadKanbanGraphPositions, upsertKanbanGraphPosition } from '$lib/db/projects'

export type TaskStatusRecord = {
    id: string
    name: string
    description: string | null
    pos_x: number
    pos_y: number
    kanban_pos_x: number
    kanban_pos_y: number
    is_initial: boolean
    is_terminal: boolean
    color: number | null
}

export type TaskStatusEdgeRecord = {
    id: string
    from_status_id: string
    to_status_id: string
    action: string | null
    color: number | null
}

export function isTerminalStatus(
    status: Pick<TaskStatusRecord, 'is_terminal'> | null | undefined,
): boolean {
    return status?.is_terminal === true
}

export type TaskStatusOption = {
    id: string
    title: string
    is_initial?: boolean
    is_terminal?: boolean
    color?: number | null
}

export type StatusTransitionAction = {
    edgeId: string | null
    toStatusId: string
    label: string
    colorHex: string
}

export function getStatusTransitionActions(
    currentStatusId: string | null,
    edges: TaskStatusEdgeRecord[],
    statusOptions: TaskStatusOption[],
): StatusTransitionAction[] {
    const statusNameById = new Map(statusOptions.map((status) => [status.id, status.title]))
    const statusColorById = new Map(statusOptions.map((status) => [status.id, status.color]))

    if (!currentStatusId) {
        const initial = statusOptions.find((status) => status.is_initial)
        if (!initial) return []

        return [{
            edgeId: null,
            toStatusId: initial.id,
            label: initial.title,
            colorHex: getStatusEdgeColorHex(null, initial.color),
        }]
    }

    return edges
        .filter((edge) => edge.from_status_id === currentStatusId)
        .map((edge) => {
            const destinationName = statusNameById.get(edge.to_status_id) ?? 'Unknown'
            const actionLabel = edge.action?.trim()

            return {
                edgeId: edge.id,
                toStatusId: edge.to_status_id,
                label: actionLabel || destinationName,
                colorHex: getStatusEdgeColorHex(
                    edge.color,
                    statusColorById.get(edge.to_status_id),
                ),
            }
        })
}

export async function loadTaskStatusMachine(projectId?: string | null): Promise<{
    statuses: TaskStatusRecord[]
    edges: TaskStatusEdgeRecord[]
}> {
    const db = await getDb()
    if (!db) {
        return { statuses: [], edges: [] }
    }

    const [statuses, edges, graphPositions] = await Promise.all([
        db.select().from(taskStatus),
        db.select().from(taskStatusEdge),
        loadKanbanGraphPositions(projectId ?? null),
    ])

    return {
        statuses: statuses.map((row) => {
            const graphPos = graphPositions.get(row.id)
            return {
                id: row.id,
                name: row.name,
                description: row.description,
                pos_x: row.pos_x ?? 0,
                pos_y: row.pos_y ?? 0,
                kanban_pos_x: graphPos?.pos_x ?? row.kanban_pos_x ?? row.pos_x ?? 0,
                kanban_pos_y: graphPos?.pos_y ?? row.kanban_pos_y ?? row.pos_y ?? 0,
                is_initial: row.is_initial,
                is_terminal: row.is_terminal,
                color: row.color,
            }
        }),
        edges: edges.map((row) => ({
            id: row.id,
            from_status_id: row.from_status_id,
            to_status_id: row.to_status_id,
            action: row.action,
            color: row.color,
        })),
    }
}

export async function loadTaskStatusOptions(): Promise<TaskStatusOption[]> {
    const db = await getDb()
    if (!db) return []

    const rows = await db
        .select({
            id: taskStatus.id,
            name: taskStatus.name,
            is_initial: taskStatus.is_initial,
            is_terminal: taskStatus.is_terminal,
            color: taskStatus.color,
        })
        .from(taskStatus)
        .orderBy(taskStatus.name)

    return rows.map((row) => ({
        id: row.id,
        title: row.name,
        is_initial: row.is_initial ?? false,
        is_terminal: row.is_terminal ?? false,
        color: row.color,
    }))
}

export async function getInitialTaskStatusId(): Promise<string | null> {
    const db = await getDb()
    if (!db) return null

    const rows = await db
        .select({ id: taskStatus.id })
        .from(taskStatus)
        .where(eq(taskStatus.is_initial, true))
        .limit(1)

    return rows[0]?.id ?? null
}

export async function createTaskStatus(input: {
    name: string
    pos_x: number
    pos_y: number
    description?: string | null
}): Promise<TaskStatusRecord> {
    const db = await getDb()
    if (!db) {
        throw new Error('Database not initialized')
    }

    const id = uuid()
    const record: TaskStatusRecord = {
        id,
        name: input.name,
        description: input.description ?? null,
        pos_x: input.pos_x,
        pos_y: input.pos_y,
        kanban_pos_x: input.pos_x,
        kanban_pos_y: input.pos_y,
        is_initial: false,
        is_terminal: false,
        color: null,
    }

    await db.insert(taskStatus).values({
        id: record.id,
        name: record.name,
        description: record.description,
        pos_x: record.pos_x,
        pos_y: record.pos_y,
        kanban_pos_x: record.kanban_pos_x,
        kanban_pos_y: record.kanban_pos_y,
        is_initial: record.is_initial,
        is_terminal: record.is_terminal,
        color: record.color,
    })

    return record
}

export async function updateTaskStatus(
    id: string,
    patch: Partial<Pick<TaskStatusRecord, 'name' | 'description' | 'pos_x' | 'pos_y' | 'color' | 'is_terminal'>>,
): Promise<void> {
    const db = await getDb()
    if (!db) {
        throw new Error('Database not initialized')
    }

    const updates: Partial<typeof taskStatus.$inferInsert> = {}
    if (patch.name !== undefined) updates.name = patch.name
    if (patch.description !== undefined) updates.description = patch.description
    if (patch.pos_x !== undefined) updates.pos_x = patch.pos_x
    if (patch.pos_y !== undefined) updates.pos_y = patch.pos_y
    if (patch.color !== undefined) updates.color = patch.color
    if (patch.is_terminal !== undefined) updates.is_terminal = patch.is_terminal

    if (Object.keys(updates).length === 0) return

    await db.update(taskStatus).set(updates).where(eq(taskStatus.id, id))
}

export async function updateTaskStatusKanbanPosition(
    id: string,
    kanban_pos_x: number,
    kanban_pos_y: number,
    projectId?: string | null,
): Promise<void> {
    await upsertKanbanGraphPosition(projectId ?? null, id, kanban_pos_x, kanban_pos_y)
}

export async function setInitialTaskStatus(id: string): Promise<void> {
    const db = await getDb()
    if (!db) {
        throw new Error('Database not initialized')
    }

    await invoke('execute_batch_sql', {
        queries: [
            {
                sql: 'UPDATE task_status SET is_initial = 0',
                params: [],
            },
            {
                sql: 'UPDATE task_status SET is_initial = 1 WHERE id = ?',
                params: [id],
            },
        ],
    })
}

export async function deleteTaskStatus(id: string): Promise<void> {
    const db = await getDb()
    if (!db) {
        throw new Error('Database not initialized')
    }

    await db.delete(taskStatus).where(eq(taskStatus.id, id))
}

export async function createTaskStatusEdge(input: {
    from_status_id: string
    to_status_id: string
    action?: string | null
    color?: number | null
}): Promise<TaskStatusEdgeRecord> {
    const db = await getDb()
    if (!db) {
        throw new Error('Database not initialized')
    }

    if (input.from_status_id === input.to_status_id) {
        throw new Error('A status cannot transition to itself')
    }

    const existing = await db
        .select({ id: taskStatusEdge.id })
        .from(taskStatusEdge)
        .where(
            and(
                eq(taskStatusEdge.from_status_id, input.from_status_id),
                eq(taskStatusEdge.to_status_id, input.to_status_id),
            ),
        )
        .limit(1)

    if (existing.length > 0) {
        throw new Error('This transition already exists')
    }

    const record: TaskStatusEdgeRecord = {
        id: uuid(),
        from_status_id: input.from_status_id,
        to_status_id: input.to_status_id,
        action: input.action ?? null,
        color: input.color ?? null,
    }

    await db.insert(taskStatusEdge).values(record)
    return record
}

export async function updateTaskStatusEdge(
    id: string,
    patch: Partial<Pick<TaskStatusEdgeRecord, 'action' | 'color'>>,
): Promise<void> {
    const db = await getDb()
    if (!db) {
        throw new Error('Database not initialized')
    }

    const updates: Partial<typeof taskStatusEdge.$inferInsert> = {}
    if (patch.action !== undefined) updates.action = patch.action
    if (patch.color !== undefined) updates.color = patch.color

    if (Object.keys(updates).length === 0) return

    await db
        .update(taskStatusEdge)
        .set(updates)
        .where(eq(taskStatusEdge.id, id))
}

export async function deleteTaskStatusEdge(id: string): Promise<void> {
    const db = await getDb()
    if (!db) {
        throw new Error('Database not initialized')
    }

    await db.delete(taskStatusEdge).where(eq(taskStatusEdge.id, id))
}

export async function getAllowedNextStatusIds(currentStatusId: string | null): Promise<string[]> {
    const db = await getDb()
    if (!db) return []

    if (!currentStatusId) {
        const initial = await getInitialTaskStatusId()
        return initial ? [initial] : []
    }

    const rows = await db
        .select({ id: taskStatusEdge.to_status_id })
        .from(taskStatusEdge)
        .where(eq(taskStatusEdge.from_status_id, currentStatusId))

    return rows.map((row) => row.id)
}

export async function isValidTaskStatusTransition(
    fromStatusId: string | null,
    toStatusId: string,
): Promise<boolean> {
    if (!fromStatusId) {
        const initial = await getInitialTaskStatusId()
        return initial === toStatusId
    }

    const db = await getDb()
    if (!db) return false

    const rows = await db
        .select({ id: taskStatusEdge.id })
        .from(taskStatusEdge)
        .where(
            and(
                eq(taskStatusEdge.from_status_id, fromStatusId),
                eq(taskStatusEdge.to_status_id, toStatusId),
            ),
        )
        .limit(1)

    return rows.length > 0 || fromStatusId === toStatusId
}
