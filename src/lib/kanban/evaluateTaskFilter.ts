import type { TaskRecord } from '$lib/db/dataView'

import type {
    FilterCondition,
    FilterGroup,
    FilterOperator,
    KanbanFilterRoot,
} from './filterTypes'
import { getFilterField } from './taskFilterFields'

function readMetricValue(task: TaskRecord, field: string): number | null {
    switch (field) {
        case 'uncertainty':
            return task.uncertainty_can_estimate === 1 ? task.uncertainty : null
        case 'complexity':
            return task.complexity_can_estimate === 1 ? task.complexity : null
        case 'effort':
            return task.effort_can_estimate === 1 ? task.effort : null
        default:
            return null
    }
}

function readMetricCanEstimate(task: TaskRecord, field: string): number | null {
    switch (field) {
        case 'uncertainty':
            return task.uncertainty_can_estimate
        case 'complexity':
            return task.complexity_can_estimate
        case 'effort':
            return task.effort_can_estimate
        default:
            return null
    }
}

function readFieldValue(task: TaskRecord, field: string): unknown {
    const fieldDef = getFilterField(field)
    if (!fieldDef) return undefined

    if (fieldDef.kind === 'metric') {
        return readMetricValue(task, field)
    }

    return task[field as keyof TaskRecord]
}

function normalizeText(value: unknown): string {
    if (value == null) return ''
    return String(value).trim().toLowerCase()
}

function parseDateValue(value: unknown): number | null {
    if (value == null || value === '') return null
    const parsed = Date.parse(String(value))
    return Number.isNaN(parsed) ? null : parsed
}

function isSameCalendarDay(left: number, right: number): boolean {
    const leftDate = new Date(left)
    const rightDate = new Date(right)
    return (
        leftDate.getFullYear() === rightDate.getFullYear() &&
        leftDate.getMonth() === rightDate.getMonth() &&
        leftDate.getDate() === rightDate.getDate()
    )
}

function compareNumbers(left: unknown, right: unknown): number | null {
    if (left == null || right == null || left === '' || right === '') return null
    const numLeft = Number(left)
    const numRight = Number(right)
    if (Number.isNaN(numLeft) || Number.isNaN(numRight)) return null
    return numLeft - numRight
}

function evaluateTextOperator(operator: FilterOperator, rawValue: unknown, compareValue: unknown): boolean {
    const value = normalizeText(rawValue)
    const needle = normalizeText(compareValue)

    switch (operator) {
        case 'contains':
            return value.includes(needle)
        case 'not_contains':
            return !value.includes(needle)
        case 'equals':
            return value === needle
        case 'not_equals':
            return value !== needle
        case 'starts_with':
            return value.startsWith(needle)
        case 'ends_with':
            return value.endsWith(needle)
        case 'is_empty':
            return value.length === 0
        case 'is_not_empty':
            return value.length > 0
        default:
            return false
    }
}

function evaluateReferenceOperator(
    operator: FilterOperator,
    rawValue: unknown,
    compareValue: unknown,
): boolean {
    const value = rawValue == null || rawValue === '' ? null : String(rawValue)
    const needle = compareValue == null || compareValue === '' ? null : String(compareValue)

    switch (operator) {
        case 'equals':
            return value === needle
        case 'not_equals':
            return value !== needle
        case 'is_empty':
            return value == null
        case 'is_not_empty':
            return value != null
        default:
            return false
    }
}

function evaluateMetricOperator(
    operator: FilterOperator,
    task: TaskRecord,
    field: string,
    compareValue: unknown,
): boolean {
    const canEstimate = readMetricCanEstimate(task, field)
    const value = readMetricValue(task, field)

    switch (operator) {
        case 'is_unknown':
            return canEstimate === 0
        case 'is_estimated':
            return canEstimate === 1
        case 'is_unset':
            return canEstimate == null
        case 'equals':
        case 'not_equals':
        case 'gt':
        case 'gte':
        case 'lt':
        case 'lte': {
            if (canEstimate !== 1 || value == null) return false
            const comparison = compareNumbers(value, compareValue)
            if (comparison == null) return false
            if (operator === 'equals') return comparison === 0
            if (operator === 'not_equals') return comparison !== 0
            if (operator === 'gt') return comparison > 0
            if (operator === 'gte') return comparison >= 0
            if (operator === 'lt') return comparison < 0
            return comparison <= 0
        }
        default:
            return false
    }
}

function evaluateDateOperator(operator: FilterOperator, rawValue: unknown, compareValue: unknown): boolean {
    const valueTime = parseDateValue(rawValue)
    const compareTime = parseDateValue(compareValue)

    switch (operator) {
        case 'is_empty':
            return valueTime == null
        case 'is_not_empty':
            return valueTime != null
        case 'before':
            return valueTime != null && compareTime != null && valueTime < compareTime
        case 'after':
            return valueTime != null && compareTime != null && valueTime > compareTime
        case 'on':
            return valueTime != null && compareTime != null && isSameCalendarDay(valueTime, compareTime)
        default:
            return false
    }
}

function evaluateCondition(task: TaskRecord, condition: FilterCondition): boolean {
    const fieldDef = getFilterField(condition.field)
    if (!fieldDef) return true

    const rawValue = readFieldValue(task, condition.field)

    switch (fieldDef.kind) {
        case 'text':
            return evaluateTextOperator(condition.operator, rawValue, condition.value)
        case 'reference':
            return evaluateReferenceOperator(condition.operator, rawValue, condition.value)
        case 'metric':
            return evaluateMetricOperator(condition.operator, task, condition.field, condition.value)
        case 'boolean':
            if (condition.operator === 'is_true') return Number(task.is_trophy) === 1
            if (condition.operator === 'is_false') return Number(task.is_trophy) !== 1
            return false
        case 'datetime':
            return evaluateDateOperator(
                condition.operator,
                fieldDef.id === 'created_at' ? task.created_at : task.updated_at,
                condition.value,
            )
        case 'number':
            return evaluateMetricOperator(condition.operator, task, condition.field, condition.value)
    }
}

function evaluateGroup(task: TaskRecord, group: FilterGroup): boolean {
    if (group.children.length === 0) return true

    const results = group.children.map((child) =>
        child.type === 'group' ? evaluateGroup(task, child) : evaluateCondition(task, child),
    )

    return group.logic === 'and' ? results.every(Boolean) : results.some(Boolean)
}

export function evaluateTaskFilter(task: TaskRecord, filter: KanbanFilterRoot): boolean {
    return evaluateGroup(task, filter)
}

export function filterKanbanTasks(tasks: TaskRecord[], filter: KanbanFilterRoot): TaskRecord[] {
    if (filter.children.length === 0) return tasks
    return tasks.filter((task) => evaluateTaskFilter(task, filter))
}
