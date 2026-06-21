export type ColumnEditorKind =
    | 'text'
    | 'number'
    | 'datetime'
    | 'color'
    | 'icon'
    | 'foreignKey'
    | 'boolean'
    | 'enum'

export type ReferenceOption = {
    id: string
    title: string
}

export type ColumnMeta = {
    name: string
    dataType: string
    isForeignKey?: boolean
    editable?: boolean
    notNull?: boolean
    defaultValue?: string | null
    isPrimaryKey?: boolean
    editorKind?: ColumnEditorKind
    refTable?: string
    refLabelColumn?: string
    referenceOptions?: ReferenceOption[]
    enumOptions?: ReferenceOption[]
}

export function isBlobColumn(column: ColumnMeta): boolean {
    return column.dataType.toUpperCase() === 'BLOB'
}

export function isGridColumn(column: ColumnMeta): boolean {
    return !isBlobColumn(column)
}
