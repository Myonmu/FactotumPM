import type { FilterFieldDef, FilterOperator } from './filterTypes'

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

const REFERENCE_OPERATORS: FilterOperator[] = [
    'equals',
    'not_equals',
    'is_empty',
    'is_not_empty',
]

const BOOLEAN_OPERATORS: FilterOperator[] = ['is_true', 'is_false']

const DATETIME_OPERATORS: FilterOperator[] = [
    'before',
    'after',
    'on',
    'is_empty',
    'is_not_empty',
]

export const TASK_FILTER_FIELDS: FilterFieldDef[] = [
    { id: 'title', label: 'Title', kind: 'text', operators: TEXT_OPERATORS },
    { id: 'description', label: 'Description', kind: 'text', operators: TEXT_OPERATORS },
    { id: 'uncertainty', label: 'Uncertainty', kind: 'metric', operators: METRIC_OPERATORS },
    { id: 'complexity', label: 'Complexity', kind: 'metric', operators: METRIC_OPERATORS },
    { id: 'effort', label: 'Effort', kind: 'metric', operators: METRIC_OPERATORS },
    { id: 'domain_id', label: 'Domain', kind: 'reference', operators: REFERENCE_OPERATORS },
    { id: 'task_status_id', label: 'Status', kind: 'reference', operators: REFERENCE_OPERATORS },
    { id: 'parent_task_id', label: 'Parent Task', kind: 'reference', operators: REFERENCE_OPERATORS },
    { id: 'is_trophy', label: 'Trophy', kind: 'boolean', operators: BOOLEAN_OPERATORS },
    { id: 'created_at', label: 'Created At', kind: 'datetime', operators: DATETIME_OPERATORS },
    { id: 'updated_at', label: 'Updated At', kind: 'datetime', operators: DATETIME_OPERATORS },
]

export function getFilterField(fieldId: string): FilterFieldDef | undefined {
    return TASK_FILTER_FIELDS.find((field) => field.id === fieldId)
}

export function getDefaultOperator(fieldId: string): FilterOperator {
    return getFilterField(fieldId)?.operators[0] ?? 'contains'
}

export function operatorNeedsValue(operator: FilterOperator): boolean {
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

export function getOperatorLabel(operator: FilterOperator): string {
    switch (operator) {
        case 'contains':
            return 'contains'
        case 'not_contains':
            return 'does not contain'
        case 'equals':
            return 'equals'
        case 'not_equals':
            return 'does not equal'
        case 'starts_with':
            return 'starts with'
        case 'ends_with':
            return 'ends with'
        case 'is_empty':
            return 'is empty'
        case 'is_not_empty':
            return 'is not empty'
        case 'gt':
            return '>'
        case 'gte':
            return '≥'
        case 'lt':
            return '<'
        case 'lte':
            return '≤'
        case 'before':
            return 'before'
        case 'after':
            return 'after'
        case 'on':
            return 'on'
        case 'is_true':
            return 'is yes'
        case 'is_false':
            return 'is no'
        case 'is_unknown':
            return 'cannot estimate'
        case 'is_estimated':
            return 'has estimate'
        case 'is_unset':
            return 'not configured'
    }
}
