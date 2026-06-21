import type { ColumnSortConfig, SortRule } from '$lib/kanban/types'

import type { TrophyView } from './computeTrophies'
import { readTrophyOrderValue, TROPHY_ORDER_FIELDS } from './trophyFields'

function compareNullable(a: unknown, b: unknown): number {
    if (a == null && b == null) return 0
    if (a == null) return 1
    if (b == null) return -1
    return 0
}

function compareValues(
    a: unknown,
    b: unknown,
    kind: 'text' | 'number' | 'datetime',
    direction: SortRule['direction'],
): number {
    const nullResult = compareNullable(a, b)
    if (a == null || b == null) {
        return direction === 'asc' ? nullResult : -nullResult
    }

    let result = 0

    if (kind === 'number') {
        result = Number(a) - Number(b)
    } else if (kind === 'datetime') {
        const timeA = Date.parse(String(a))
        const timeB = Date.parse(String(b))
        result =
            Number.isNaN(timeA) && Number.isNaN(timeB)
                ? 0
                : Number.isNaN(timeA)
                  ? 1
                  : Number.isNaN(timeB)
                    ? -1
                    : timeA - timeB
    } else {
        result = String(a).localeCompare(String(b), undefined, { sensitivity: 'base' })
    }

    return direction === 'asc' ? result : -result
}

export function sortTrophies(views: TrophyView[], rules: ColumnSortConfig): TrophyView[] {
    const activeRules = rules.filter((rule) =>
        TROPHY_ORDER_FIELDS.some((field) => field.id === rule.field),
    )

    if (activeRules.length === 0) {
        return [...views]
    }

    return [...views].sort((left, right) => {
        for (const rule of activeRules) {
            const fieldMeta = TROPHY_ORDER_FIELDS.find((field) => field.id === rule.field)
            if (!fieldMeta) continue

            const leftValue = readTrophyOrderValue(left, rule.field)
            const rightValue = readTrophyOrderValue(right, rule.field)
            const result = compareValues(leftValue, rightValue, fieldMeta.kind, rule.direction)

            if (result !== 0) return result
        }

        return left.task.title.localeCompare(right.task.title, undefined, { sensitivity: 'base' })
    })
}
