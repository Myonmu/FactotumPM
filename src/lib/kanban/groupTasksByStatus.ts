import type { TaskRecord } from '$lib/db/dataView'
import type { TaskStatusRecord } from '$lib/db/taskStatusMachine'
import { filterKanbanTasks } from '$lib/kanban/evaluateTaskFilter'
import type { KanbanFilterRoot } from '$lib/kanban/filterTypes'
import { createDefaultFilter } from '$lib/kanban/filterUtils'
import {
    resolveColumnFilter,
    resolveColumnSort,
    type KanbanGlobalFilters,
} from '$lib/kanban/kanbanGlobalFilters'
import { sortTasksByRules } from '$lib/kanban/sortTasks'
import { DEFAULT_COLUMN_SORT } from '$lib/kanban/taskOrderFields'
import type { ColumnSortConfig } from '$lib/kanban/types'

export function groupTasksByStatus(
    statuses: TaskStatusRecord[],
    tasks: TaskRecord[],
    columnSorts: Record<string, ColumnSortConfig>,
    columnFilters: Record<string, KanbanFilterRoot> = {},
    globalFilters?: KanbanGlobalFilters,
): Map<string, TaskRecord[]> {
    const sortedStatuses = [...statuses].sort(
        (left, right) => left.pos_x - right.pos_x || left.name.localeCompare(right.name),
    )

    const grouped = new Map<string, TaskRecord[]>()
    for (const status of sortedStatuses) {
        grouped.set(status.id, [])
    }

    for (const task of tasks) {
        const statusId = task.task_status_id
        if (statusId && grouped.has(statusId)) {
            grouped.get(statusId)?.push(task)
            continue
        }

        const fallbackStatusId = sortedStatuses[0]?.id
        if (fallbackStatusId) {
            grouped.get(fallbackStatusId)?.push(task)
        }
    }

    const result = new Map<string, TaskRecord[]>()
    for (const [statusId, statusTasks] of grouped.entries()) {
        const filter = globalFilters
            ? resolveColumnFilter(statusId, columnFilters, globalFilters)
            : (columnFilters[statusId] ?? createDefaultFilter())
        const filtered = filterKanbanTasks(statusTasks, filter)
        const rules = globalFilters
            ? resolveColumnSort(statusId, columnSorts, globalFilters)
            : (columnSorts[statusId] ?? DEFAULT_COLUMN_SORT)
        result.set(statusId, sortTasksByRules(filtered, rules))
    }

    return result
}