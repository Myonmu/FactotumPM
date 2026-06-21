export type FilterLogic = 'and' | 'or'

export type FilterOperator =
    | 'contains'
    | 'not_contains'
    | 'equals'
    | 'not_equals'
    | 'starts_with'
    | 'ends_with'
    | 'is_empty'
    | 'is_not_empty'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'before'
    | 'after'
    | 'on'
    | 'is_true'
    | 'is_false'
    | 'is_unknown'
    | 'is_estimated'
    | 'is_unset'

export type FilterCondition = {
    id: string
    type: 'condition'
    field: string
    operator: FilterOperator
    value?: string | number | null
}

export type FilterGroup = {
    id: string
    type: 'group'
    logic: FilterLogic
    children: FilterNode[]
}

export type FilterNode = FilterCondition | FilterGroup

export type KanbanFilterRoot = FilterGroup

export type FilterFieldKind = 'text' | 'number' | 'metric' | 'reference' | 'boolean' | 'datetime'

export type FilterFieldDef = {
    id: string
    label: string
    kind: FilterFieldKind
    operators: FilterOperator[]
}
