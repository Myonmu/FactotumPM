import type { ColumnMeta } from '$lib/tableRendering'

export type DataTableGridContext = {
    tableName: string
    rows: Record<string, unknown>[]
    columns: ColumnMeta[]
}

export const DATA_TABLE_GRID_CONTEXT = Symbol('dataTableGrid')
