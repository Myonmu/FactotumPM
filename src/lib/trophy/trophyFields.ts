import { v4 as uuid } from 'uuid'

import type { DomainOption } from '$lib/db/dataView'
import type { FilterCondition, FilterOperator } from '$lib/kanban/filterTypes'

import type { TrophyView } from './computeTrophies'

export type TrophyFieldKind =
    | 'text'
    | 'number'
    | 'metric'
    | 'domain'
    | 'status'
    | 'type'
    | 'boolean'
    | 'datetime'

export type TrophyFilterFieldDef = {
    id: string
    label: string
    kind: TrophyFieldKind
    operators: FilterOperator[]
}

const TEXT_OPERATORS: FilterOperator[] = [
    'contains',
    'not_contains',
    'equals',
    'not_equals',
    'starts_with',
    'ends_with',
    'is_empty',
    'is_not_empty',
]

const METRIC_OPERATORS: FilterOperator[] = [
    'equals',
    'not_equals',
    'gt',
    'gte',
    'lt',
    'lte',
    'is_unknown',
    'is_estimated',
    'is_unset',
]

const NUMBER_OPERATORS: FilterOperator[] = ['equals', 'not_equals', 'gt', 'gte', 'lt', 'lte']

const REFERENCE_OPERATORS: FilterOperator[] = ['equals', 'not_equals', 'is_empty', 'is_not_empty']

const TYPE_OPERATORS: FilterOperator[] = ['equals', 'not_equals', 'contains']

const BOOLEAN_OPERATORS: FilterOperator[] = ['is_true', 'is_false']

const DATETIME_OPERATORS: FilterOperator[] = ['before', 'after', 'on', 'is_empty', 'is_not_empty']

export const TROPHY_FILTER_FIELDS: TrophyFilterFieldDef[] = [
    { id: 'title', label: 'Title', kind: 'text', operators: TEXT_OPERATORS },
    { id: 'description', label: 'Description', kind: 'text', operators: TEXT_OPERATORS },
    { id: 'trophy_size', label: 'Trophy Size', kind: 'number', operators: NUMBER_OPERATORS },
    { id: 'progression', label: 'Progression %', kind: 'number', operators: NUMBER_OPERATORS },
    { id: 'time_spent', label: 'Time Spent (min)', kind: 'number', operators: NUMBER_OPERATORS },
    { id: 'trophy_type', label: 'Type', kind: 'type', operators: TYPE_OPERATORS },
    { id: 'value', label: 'Value', kind: 'number', operators: NUMBER_OPERATORS },
    { id: 'achieved', label: 'Achieved', kind: 'boolean', operators: BOOLEAN_OPERATORS },
    { id: 'uncertainty', label: 'Uncertainty', kind: 'metric', operators: METRIC_OPERATORS },
    { id: 'complexity', label: 'Complexity', kind: 'metric', operators: METRIC_OPERATORS },
    { id: 'effort', label: 'Effort', kind: 'metric', operators: METRIC_OPERATORS },
    { id: 'domain_id', label: 'Domain', kind: 'domain', operators: REFERENCE_OPERATORS },
    { id: 'task_status_id', label: 'Status', kind: 'status', operators: REFERENCE_OPERATORS },
    { id: 'created_at', label: 'Created At', kind: 'datetime', operators: DATETIME_OPERATORS },
    { id: 'updated_at', label: 'Updated At', kind: 'datetime', operators: DATETIME_OPERATORS },
]

export function getTrophyFilterField(fieldId: string): TrophyFilterFieldDef | undefined {
    return TROPHY_FILTER_FIELDS.find((field) => field.id === fieldId)
}

export function getTrophyDefaultOperator(fieldId: string): FilterOperator {
    return getTrophyFilterField(fieldId)?.operators[0] ?? 'contains'
}

export function createTrophyFilterCondition(field = 'trophy_size'): FilterCondition {
    return {
        id: uuid(),
        type: 'condition',
        field,
        operator: getTrophyDefaultOperator(field),
        value: '',
    }
}

export function trophyOperatorNeedsValue(operator: FilterOperator): boolean {
    return ![
        'is_empty',
        'is_not_empty',
        'is_true',
        'is_false',
        'is_unknown',
        'is_estimated',
        'is_unset',
    ].includes(operator)
}

export type TrophyOrderField = {
    id: string
    label: string
    kind: 'text' | 'number' | 'datetime'
}

export const TROPHY_ORDER_FIELDS: TrophyOrderField[] = [
    { id: 'trophy_size', label: 'Trophy Size', kind: 'number' },
    { id: 'progression', label: 'Progression %', kind: 'number' },
    { id: 'time_spent', label: 'Time Spent', kind: 'number' },
    { id: 'value', label: 'Value', kind: 'number' },
    { id: 'title', label: 'Title', kind: 'text' },
    { id: 'trophy_type', label: 'Type', kind: 'text' },
    { id: 'achieved', label: 'Achieved', kind: 'number' },
    { id: 'uncertainty', label: 'Uncertainty', kind: 'number' },
    { id: 'complexity', label: 'Complexity', kind: 'number' },
    { id: 'effort', label: 'Effort', kind: 'number' },
    { id: 'created_at', label: 'Created At', kind: 'datetime' },
    { id: 'updated_at', label: 'Updated At', kind: 'datetime' },
]

export const DEFAULT_TROPHY_SORT = [{ field: 'trophy_size', direction: 'desc' as const }]

export type TrophyGroupOption = {
    id: string
    label: string
}

export const TROPHY_GROUP_OPTIONS: TrophyGroupOption[] = [
    { id: 'none', label: 'No grouping' },
    { id: 'trophy_type', label: 'Type' },
    { id: 'domain_id', label: 'Domain' },
    { id: 'task_status_id', label: 'Status' },
    { id: 'achieved', label: 'Achieved' },
    { id: 'size_bucket', label: 'Size range' },
    { id: 'progression_bucket', label: 'Progression range' },
    { id: 'time_bucket', label: 'Time spent range' },
]

/** Time spent expressed as integer minutes. */
export function timeSpentMinutes(view: TrophyView): number {
    return Math.round(view.timeSpentMs / 60_000)
}

/** Read a task's metric value honoring its can-estimate flag (null when not estimable). */
function readMetricValue(view: TrophyView, field: string): number | null {
    const task = view.task
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

export function readMetricCanEstimate(view: TrophyView, field: string): number | null {
    const task = view.task
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

/** Progression expressed as an integer percentage (0..100). */
export function progressionPercent(view: TrophyView): number {
    return Math.round(view.progression * 100)
}

/** Raw value used for filter comparisons (kind-aware). */
export function readTrophyFieldValue(view: TrophyView, fieldId: string): unknown {
    switch (fieldId) {
        case 'title':
            return view.task.title
        case 'description':
            return view.task.description
        case 'trophy_size':
            return view.sizeOptimistic
        case 'progression':
            return progressionPercent(view)
        case 'time_spent':
            return timeSpentMinutes(view)
        case 'value':
            return view.value
        case 'trophy_type':
            return view.type.shortLabel
        case 'achieved':
            return view.achieved
        case 'uncertainty':
        case 'complexity':
        case 'effort':
            return readMetricValue(view, fieldId)
        case 'domain_id':
            return view.task.domain_id
        case 'task_status_id':
            return view.task.task_status_id
        case 'created_at':
            return view.task.created_at
        case 'updated_at':
            return view.task.updated_at
        default:
            return undefined
    }
}

/** Value used for ordering (number/text/datetime). */
export function readTrophyOrderValue(view: TrophyView, fieldId: string): unknown {
    switch (fieldId) {
        case 'trophy_size':
            return view.sizeOptimistic
        case 'progression':
            return progressionPercent(view)
        case 'time_spent':
            return timeSpentMinutes(view)
        case 'value':
            return view.value
        case 'achieved':
            return view.achieved ? 1 : 0
        case 'trophy_type':
            return view.type.shortLabel
        case 'uncertainty':
        case 'complexity':
        case 'effort':
            return readMetricValue(view, fieldId)
        default:
            return readTrophyFieldValue(view, fieldId)
    }
}

export type TrophyGroupContext = {
    domains: DomainOption[]
    statuses: { id: string; title: string }[]
}

export type TrophyGroupKey = {
    key: string
    label: string
    /** Sort weight so groups appear in a sensible order. */
    sortKey: number
}

function sizeBucket(size: number): TrophyGroupKey {
    if (size <= 0) return { key: '0', label: 'Empty (0)', sortKey: 0 }
    if (size < 25) return { key: '0-25', label: 'Small (< 25)', sortKey: 1 }
    if (size < 100) return { key: '25-100', label: 'Medium (25–100)', sortKey: 2 }
    if (size < 300) return { key: '100-300', label: 'Large (100–300)', sortKey: 3 }
    return { key: '300+', label: 'Epic (300+)', sortKey: 4 }
}

function timeBucket(minutes: number): TrophyGroupKey {
    if (minutes <= 0) return { key: '0', label: 'No time logged', sortKey: 0 }
    if (minutes < 60) return { key: '0-1h', label: '< 1h', sortKey: 1 }
    if (minutes < 300) return { key: '1-5h', label: '1–5h', sortKey: 2 }
    if (minutes < 600) return { key: '5-10h', label: '5–10h', sortKey: 3 }
    return { key: '10h+', label: '10h+', sortKey: 4 }
}

function progressionBucket(percent: number): TrophyGroupKey {
    if (percent <= 0) return { key: '0', label: 'Not started (0%)', sortKey: 0 }
    if (percent >= 100) return { key: '100', label: 'Complete (100%)', sortKey: 5 }
    if (percent < 25) return { key: '1-25', label: '1–25%', sortKey: 1 }
    if (percent < 50) return { key: '25-50', label: '25–50%', sortKey: 2 }
    if (percent < 75) return { key: '50-75', label: '50–75%', sortKey: 3 }
    return { key: '75-99', label: '75–99%', sortKey: 4 }
}

export function resolveTrophyGroup(
    view: TrophyView,
    groupField: string,
    ctx: TrophyGroupContext,
): TrophyGroupKey {
    switch (groupField) {
        case 'trophy_type':
            return { key: view.type.key, label: view.type.shortLabel, sortKey: 0 }
        case 'domain_id': {
            const id = view.task.domain_id
            if (!id) return { key: '__none__', label: 'No domain', sortKey: 1 }
            const domain = ctx.domains.find((entry) => entry.id === id)
            return { key: id, label: domain?.title ?? 'Unknown domain', sortKey: 0 }
        }
        case 'task_status_id': {
            const id = view.task.task_status_id
            if (!id) return { key: '__none__', label: 'No status', sortKey: 1 }
            const status = ctx.statuses.find((entry) => entry.id === id)
            return { key: id, label: status?.title ?? 'Unknown status', sortKey: 0 }
        }
        case 'achieved':
            return view.achieved
                ? { key: 'achieved', label: 'Achieved', sortKey: 0 }
                : { key: 'in_progress', label: 'In progress', sortKey: 1 }
        case 'size_bucket':
            return sizeBucket(view.sizeOptimistic)
        case 'progression_bucket':
            return progressionBucket(progressionPercent(view))
        case 'time_bucket':
            return timeBucket(timeSpentMinutes(view))
        default:
            return { key: '__all__', label: 'All trophies', sortKey: 0 }
    }
}
