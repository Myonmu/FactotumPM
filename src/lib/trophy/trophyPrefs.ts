import { getPrefJson, getPrefString, savePrefJson, savePrefString } from '$lib/prefStore'
import { createDefaultFilter } from '$lib/kanban/filterUtils'
import type { KanbanFilterRoot } from '$lib/kanban/filterTypes'
import type { ColumnSortConfig, SortRule } from '$lib/kanban/types'

import { DEFAULT_TROPHY_SORT } from './trophyFields'

const FILTER_KEY = 'trophy.filter'
const SORT_KEY = 'trophy.sort'
const GROUP_KEY = 'trophy.group'
const VIEW_MODE_KEY = 'trophy.viewMode'

export type TrophyViewMode = 'grid' | 'graph'

export async function loadTrophyFilter(): Promise<KanbanFilterRoot> {
    const stored = await getPrefJson<KanbanFilterRoot>(FILTER_KEY)
    if (stored && stored.type === 'group' && Array.isArray(stored.children)) {
        return stored
    }
    return createDefaultFilter()
}

export async function saveTrophyFilter(filter: KanbanFilterRoot): Promise<void> {
    await savePrefJson(FILTER_KEY, filter)
}

function isSortDirection(value: unknown): value is SortRule['direction'] {
    return value === 'asc' || value === 'desc'
}

export async function loadTrophySort(): Promise<ColumnSortConfig> {
    const stored = await getPrefJson<unknown>(SORT_KEY)
    if (Array.isArray(stored)) {
        const rules = stored.filter(
            (entry): entry is SortRule =>
                Boolean(entry) &&
                typeof entry === 'object' &&
                typeof (entry as SortRule).field === 'string' &&
                isSortDirection((entry as SortRule).direction),
        )
        if (rules.length > 0) return rules
    }
    return [...DEFAULT_TROPHY_SORT]
}

export async function saveTrophySort(sort: ColumnSortConfig): Promise<void> {
    await savePrefJson(SORT_KEY, sort)
}

export async function loadTrophyGroup(): Promise<string> {
    return (await getPrefString(GROUP_KEY)) ?? 'none'
}

export async function saveTrophyGroup(group: string): Promise<void> {
    await savePrefString(GROUP_KEY, group)
}

export async function loadTrophyViewMode(): Promise<TrophyViewMode> {
    const stored = await getPrefString(VIEW_MODE_KEY)
    return stored === 'graph' ? 'graph' : 'grid'
}

export async function saveTrophyViewMode(mode: TrophyViewMode): Promise<void> {
    await savePrefString(VIEW_MODE_KEY, mode)
}
