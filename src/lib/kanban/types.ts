export type SortDirection = 'asc' | 'desc'

export type SortRule = {
    field: string
    direction: SortDirection
}

export type ColumnSortConfig = SortRule[]

export type KanbanViewMode = 'traditional' | 'graph'

export type OrderableTaskField = {
    id: string
    label: string
    kind: 'text' | 'number' | 'datetime'
}
