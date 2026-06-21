import type { TaskStatusRecord } from '$lib/db/taskStatusMachine'

export const TRADITIONAL_COLUMN_POS_X_STEP = 100

export function reorderStatusesById(
    statuses: TaskStatusRecord[],
    fromId: string,
    toId: string,
): TaskStatusRecord[] {
    if (fromId === toId) return statuses

    const fromIndex = statuses.findIndex((status) => status.id === fromId)
    const toIndex = statuses.findIndex((status) => status.id === toId)
    if (fromIndex === -1 || toIndex === -1) return statuses

    const reordered = [...statuses]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)
    return reordered
}

export function buildTraditionalColumnPosUpdates(
    orderedStatuses: TaskStatusRecord[],
): Array<{ id: string; pos_x: number }> {
    return orderedStatuses.map((status, index) => ({
        id: status.id,
        pos_x: index * TRADITIONAL_COLUMN_POS_X_STEP,
    }))
}

export function applyPosUpdatesToStatuses(
    statuses: TaskStatusRecord[],
    updates: Array<{ id: string; pos_x: number }>,
): TaskStatusRecord[] {
    const posById = new Map(updates.map((update) => [update.id, update.pos_x]))
    return statuses.map((status) => {
        const pos_x = posById.get(status.id)
        return pos_x === undefined ? status : { ...status, pos_x }
    })
}
