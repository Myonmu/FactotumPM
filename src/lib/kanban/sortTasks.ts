import { TASK_ORDER_FIELDS } from './taskOrderFields'
import type { ColumnSortConfig, SortRule } from './types'
import type { TaskRecord } from '$lib/db/dataView'

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
        const numA = Number(a)
        const numB = Number(b)
        result = numA - numB
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

export function sortTasksByRules(tasks: TaskRecord[], rules: ColumnSortConfig): TaskRecord[] {
    if (rules.length === 0) {
        return [...tasks]
    }

    const activeRules = rules.filter((rule) =>
        TASK_ORDER_FIELDS.some((field) => field.id === rule.field),
    )

    if (activeRules.length === 0) {
        return [...tasks]
    }

    return [...tasks].sort((left, right) => {
        for (const rule of activeRules) {
            const fieldMeta = TASK_ORDER_FIELDS.find((field) => field.id === rule.field)
            if (!fieldMeta) continue

            const leftValue = left[rule.field as keyof TaskRecord]
            const rightValue = right[rule.field as keyof TaskRecord]
            const result = compareValues(leftValue, rightValue, fieldMeta.kind, rule.direction)

            if (result !== 0) {
                return result
            }
        }

        return left.title.localeCompare(right.title, undefined, { sensitivity: 'base' })
    })
}
