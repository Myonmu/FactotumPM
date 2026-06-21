import type {
    FilterCondition,
    FilterGroup,
    FilterOperator,
    KanbanFilterRoot,
} from '$lib/kanban/filterTypes'

import type { TrophyView } from './computeTrophies'
import {
    getTrophyFilterField,
    readMetricCanEstimate,
    readTrophyFieldValue,
} from './trophyFields'

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

function evaluateReferenceOperator(operator: FilterOperator, rawValue: unknown, compareValue: unknown): boolean {
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

function evaluateNumberOperator(operator: FilterOperator, rawValue: unknown, compareValue: unknown): boolean {
    const comparison = compareNumbers(rawValue, compareValue)
    if (comparison == null) return false

    switch (operator) {
        case 'equals':
            return comparison === 0
        case 'not_equals':
            return comparison !== 0
        case 'gt':
            return comparison > 0
        case 'gte':
            return comparison >= 0
        case 'lt':
            return comparison < 0
        case 'lte':
            return comparison <= 0
        default:
            return false
    }
}

function evaluateMetricOperator(
    operator: FilterOperator,
    view: TrophyView,
    field: string,
    compareValue: unknown,
): boolean {
    const canEstimate = readMetricCanEstimate(view, field)
    const value = readTrophyFieldValue(view, field)

    switch (operator) {
        case 'is_unknown':
            return canEstimate === 0
        case 'is_estimated':
            return canEstimate === 1
        case 'is_unset':
            return canEstimate == null
        default:
            if (canEstimate !== 1 || value == null) return false
            return evaluateNumberOperator(operator, value, compareValue)
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

function evaluateCondition(view: TrophyView, condition: FilterCondition): boolean {
    const fieldDef = getTrophyFilterField(condition.field)
    if (!fieldDef) return true

    const rawValue = readTrophyFieldValue(view, condition.field)

    switch (fieldDef.kind) {
        case 'text':
            return evaluateTextOperator(condition.operator, rawValue, condition.value)
        case 'type':
            if (condition.operator === 'contains') {
                return evaluateTextOperator('contains', rawValue, condition.value)
            }
            return evaluateReferenceOperator(condition.operator, rawValue, condition.value)
        case 'domain':
        case 'status':
            return evaluateReferenceOperator(condition.operator, rawValue, condition.value)
        case 'number':
            return evaluateNumberOperator(condition.operator, rawValue, condition.value)
        case 'metric':
            return evaluateMetricOperator(condition.operator, view, condition.field, condition.value)
        case 'boolean':
            if (condition.operator === 'is_true') return view.achieved === true
            if (condition.operator === 'is_false') return view.achieved !== true
            return false
        case 'datetime':
            return evaluateDateOperator(condition.operator, rawValue, condition.value)
        default:
            return true
    }
}

function evaluateGroup(view: TrophyView, group: FilterGroup): boolean {
    if (group.children.length === 0) return true

    const results = group.children.map((child) =>
        child.type === 'group' ? evaluateGroup(view, child) : evaluateCondition(view, child),
    )

    return group.logic === 'and' ? results.every(Boolean) : results.some(Boolean)
}

export function evaluateTrophyFilter(view: TrophyView, filter: KanbanFilterRoot): boolean {
    return evaluateGroup(view, filter)
}

export function filterTrophies(views: TrophyView[], filter: KanbanFilterRoot): TrophyView[] {
    if (filter.children.length === 0) return views
    return views.filter((view) => evaluateTrophyFilter(view, filter))
}
