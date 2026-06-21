import type { OrderableTaskField } from './types'

export const TASK_ORDER_FIELDS: OrderableTaskField[] = [
    { id: 'title', label: 'Title', kind: 'text' },
    { id: 'description', label: 'Description', kind: 'text' },
    { id: 'uncertainty', label: 'Uncertainty', kind: 'number' },
    { id: 'complexity', label: 'Complexity', kind: 'number' },
    { id: 'effort', label: 'Effort', kind: 'number' },
    { id: 'domain_id', label: 'Domain', kind: 'text' },
    { id: 'parent_task_id', label: 'Parent Task', kind: 'text' },
    { id: 'is_trophy', label: 'Trophy', kind: 'number' },
    { id: 'created_at', label: 'Created At', kind: 'datetime' },
    { id: 'updated_at', label: 'Updated At', kind: 'datetime' },
]

export const DEFAULT_COLUMN_SORT = [{ field: 'created_at', direction: 'asc' as const }]

export function getOrderFieldLabel(fieldId: string): string {
    return TASK_ORDER_FIELDS.find((field) => field.id === fieldId)?.label ?? fieldId
}
