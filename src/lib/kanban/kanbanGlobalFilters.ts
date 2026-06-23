import { getPrefJson, savePrefJson } from '$lib/prefStore'
import type { TaskRecord } from '$lib/db/dataView'
import { parseColumnSortValue } from '$lib/kanban/columnSortPrefs'
import type { KanbanFilterRoot } from '$lib/kanban/filterTypes'
import { createDefaultFilter } from '$lib/kanban/filterUtils'
import { parseKanbanFilterValue } from '$lib/kanban/kanbanFilterPrefs'
import { DEFAULT_COLUMN_SORT } from '$lib/kanban/taskOrderFields'
import type { ColumnSortConfig } from '$lib/kanban/types'

const PREF_KEY = 'kanban.globalFilters'

export type KanbanGlobalFilters = {
    ignoreTrophyTasks: boolean
    ignoreTasksWithChildren: boolean
    useGlobalColumnFilter: boolean
    globalColumnFilter: KanbanFilterRoot
    useGlobalColumnSort: boolean
    globalColumnSort: ColumnSortConfig
}

export const DEFAULT_KANBAN_GLOBAL_FILTERS: KanbanGlobalFilters = {
    ignoreTrophyTasks: false,
    ignoreTasksWithChildren: false,
    useGlobalColumnFilter: false,
    globalColumnFilter: createDefaultFilter(),
    useGlobalColumnSort: false,
    globalColumnSort: [...DEFAULT_COLUMN_SORT],
}

function parseKanbanGlobalFilters(raw: unknown): KanbanGlobalFilters {
    if (!raw || typeof raw !== 'object') {
        return {
            ...DEFAULT_KANBAN_GLOBAL_FILTERS,
            globalColumnFilter: createDefaultFilter(),
            globalColumnSort: [...DEFAULT_COLUMN_SORT],
        }
    }

    const value = raw as Partial<KanbanGlobalFilters>
    return {
        ignoreTrophyTasks: value.ignoreTrophyTasks === true,
        ignoreTasksWithChildren: value.ignoreTasksWithChildren === true,
        useGlobalColumnFilter: value.useGlobalColumnFilter === true,
        globalColumnFilter: parseKanbanFilterValue(value.globalColumnFilter),
        useGlobalColumnSort: value.useGlobalColumnSort === true,
        globalColumnSort: parseColumnSortValue(value.globalColumnSort),
    }
}

export function buildParentTaskIdsWithChildren(tasks: TaskRecord[]): Set<string> {
    const parentIds = new Set<string>()
    for (const task of tasks) {
        if (task.parent_task_id) {
            parentIds.add(task.parent_task_id)
        }
    }
    return parentIds
}

export function applyKanbanGlobalFilters(
    tasks: TaskRecord[],
    filters: KanbanGlobalFilters,
    parentIdsWithChildren = buildParentTaskIdsWithChildren(tasks),
): TaskRecord[] {
    let result = tasks

    if (filters.ignoreTrophyTasks) {
        result = result.filter((task) => !task.is_trophy)
    }

    if (filters.ignoreTasksWithChildren) {
        result = result.filter((task) => !parentIdsWithChildren.has(task.id))
    }

    return result
}

export function resolveColumnFilter(
    statusId: string,
    columnFilters: Record<string, KanbanFilterRoot>,
    globalFilters: KanbanGlobalFilters,
): KanbanFilterRoot {
    if (globalFilters.useGlobalColumnFilter) {
        return globalFilters.globalColumnFilter
    }

    return columnFilters[statusId] ?? createDefaultFilter()
}

export function resolveColumnSort(
    statusId: string,
    columnSorts: Record<string, ColumnSortConfig>,
    globalFilters: KanbanGlobalFilters,
): ColumnSortConfig {
    if (globalFilters.useGlobalColumnSort) {
        return globalFilters.globalColumnSort
    }

    return columnSorts[statusId] ?? DEFAULT_COLUMN_SORT
}

export async function loadKanbanGlobalFilters(): Promise<KanbanGlobalFilters> {
    const stored = await getPrefJson<unknown>(PREF_KEY)
    return parseKanbanGlobalFilters(stored)
}

export async function saveKanbanGlobalFilters(filters: KanbanGlobalFilters): Promise<void> {
    await savePrefJson(PREF_KEY, filters)
}
