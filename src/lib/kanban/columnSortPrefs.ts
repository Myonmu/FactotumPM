import { getPrefString, savePrefString } from '$lib/prefStore'

import { DEFAULT_COLUMN_SORT } from './taskOrderFields'
import type { ColumnSortConfig, SortRule } from './types'

const PREF_PREFIX = 'kanban.columnSort.'

function isSortDirection(value: unknown): value is SortRule['direction'] {
    return value === 'asc' || value === 'desc'
}

function parseColumnSortConfig(raw: string | null): ColumnSortConfig {
    if (!raw) {
        return [...DEFAULT_COLUMN_SORT]
    }

    try {
        const parsed = JSON.parse(raw) as unknown
        return parseColumnSortValue(parsed)
    } catch {
        return [...DEFAULT_COLUMN_SORT]
    }
}

export function parseColumnSortValue(raw: unknown): ColumnSortConfig {
    if (!Array.isArray(raw)) {
        return [...DEFAULT_COLUMN_SORT]
    }

    const rules = raw
        .filter((entry): entry is SortRule => {
            if (!entry || typeof entry !== 'object') return false
            const rule = entry as SortRule
            return typeof rule.field === 'string' && isSortDirection(rule.direction)
        })
        .map((rule) => ({
            field: rule.field,
            direction: rule.direction,
        }))

    return rules.length > 0 ? rules : [...DEFAULT_COLUMN_SORT]
}

export async function loadColumnSortConfig(statusId: string): Promise<ColumnSortConfig> {
    const raw = await getPrefString(`${PREF_PREFIX}${statusId}`)
    return parseColumnSortConfig(raw)
}

export async function saveColumnSortConfig(
    statusId: string,
    config: ColumnSortConfig,
): Promise<void> {
    await savePrefString(`${PREF_PREFIX}${statusId}`, JSON.stringify(config))
}

export async function loadAllColumnSortConfigs(
    statusIds: string[],
): Promise<Record<string, ColumnSortConfig>> {
    const entries = await Promise.all(
        statusIds.map(async (statusId) => [statusId, await loadColumnSortConfig(statusId)] as const),
    )

    return Object.fromEntries(entries)
}
