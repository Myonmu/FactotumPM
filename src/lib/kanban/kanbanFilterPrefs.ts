import { getPrefString, savePrefString } from '$lib/prefStore'

import { createDefaultFilter } from './filterUtils'
import type { FilterCondition, FilterGroup, FilterNode, KanbanFilterRoot } from './filterTypes'
import { getDefaultOperator, getFilterField } from './taskFilterFields'

const PREF_PREFIX = 'kanban.columnFilter.'

function isFilterLogic(value: unknown): value is FilterGroup['logic'] {
    return value === 'and' || value === 'or'
}

function parseCondition(raw: unknown): FilterCondition | null {
    if (!raw || typeof raw !== 'object') return null
    const entry = raw as FilterCondition
    if (entry.type !== 'condition' || typeof entry.id !== 'string' || typeof entry.field !== 'string') {
        return null
    }
    if (!getFilterField(entry.field)) return null
    if (typeof entry.operator !== 'string') return null

    const fieldDef = getFilterField(entry.field)
    if (!fieldDef?.operators.includes(entry.operator as FilterCondition['operator'])) {
        return {
            id: entry.id,
            type: 'condition',
            field: entry.field,
            operator: getDefaultOperator(entry.field),
            value: entry.value ?? '',
        }
    }

    return {
        id: entry.id,
        type: 'condition',
        field: entry.field,
        operator: entry.operator as FilterCondition['operator'],
        value: entry.value ?? '',
    }
}

function parseGroup(raw: unknown): FilterGroup | null {
    if (!raw || typeof raw !== 'object') return null
    const entry = raw as FilterGroup
    if (entry.type !== 'group' || typeof entry.id !== 'string' || !isFilterLogic(entry.logic)) {
        return null
    }
    if (!Array.isArray(entry.children)) return null

    const children: FilterNode[] = []
    for (const child of entry.children) {
        if (child && typeof child === 'object' && (child as FilterNode).type === 'group') {
            const parsedGroup = parseGroup(child)
            if (parsedGroup) children.push(parsedGroup)
            continue
        }

        const parsedCondition = parseCondition(child)
        if (parsedCondition) children.push(parsedCondition)
    }

    return {
        id: entry.id,
        type: 'group',
        logic: entry.logic,
        children,
    }
}

function parseKanbanFilter(raw: string | null): KanbanFilterRoot {
    if (!raw) return createDefaultFilter()

    try {
        const parsed = parseGroup(JSON.parse(raw))
        return parsed ?? createDefaultFilter()
    } catch {
        return createDefaultFilter()
    }
}

export function parseKanbanFilterValue(raw: unknown): KanbanFilterRoot {
    if (typeof raw === 'string') return parseKanbanFilter(raw)
    const parsed = parseGroup(raw)
    return parsed ?? createDefaultFilter()
}

export async function loadColumnFilterConfig(statusId: string): Promise<KanbanFilterRoot> {
    const raw = await getPrefString(`${PREF_PREFIX}${statusId}`)
    return parseKanbanFilter(raw)
}

export async function saveColumnFilterConfig(
    statusId: string,
    filter: KanbanFilterRoot,
): Promise<void> {
    await savePrefString(`${PREF_PREFIX}${statusId}`, JSON.stringify(filter))
}

export async function loadAllColumnFilterConfigs(
    statusIds: string[],
): Promise<Record<string, KanbanFilterRoot>> {
    const entries = await Promise.all(
        statusIds.map(async (statusId) => [statusId, await loadColumnFilterConfig(statusId)] as const),
    )

    return Object.fromEntries(entries)
}
