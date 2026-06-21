<script lang="ts">
    import { Grid } from '@svar-ui/svelte-grid'
    import type { IColumnConfig } from '@svar-ui/svelte-grid'
    import { setContext } from 'svelte'

    import ColorCell from '$lib/components/grid/ColorCell.svelte'
    import ColorPickerPopover from '$lib/components/ColorPickerPopover.svelte'
    import DateTimePickerPopover from '$lib/components/DateTimePickerPopover.svelte'
    import IconCell from '$lib/components/grid/IconCell.svelte'
    import IconPickerPopover from '$lib/components/IconPickerPopover.svelte'
    import {
        isNullOptionValue,
        NULL_OPTION_VALUE,
        normalizeOptionalValue,
    } from '$lib/grid/columnEditorUtils'
    import { resolveRowIconColor } from '$lib/grid/colorUtils'
    import {
        DATA_TABLE_GRID_CONTEXT,
        type DataTableGridContext,
    } from '$lib/grid/dataTableGridContext'
    import { formatDateTimeValue } from '$lib/grid/dateTimeUtils'
    import type { ColumnMeta } from '$lib/tableRendering'
    import { isGridColumn } from '$lib/tableRendering'

    type GridOption = {
        id: string | number
        label: string
    }

    type GridColumn = IColumnConfig & {
        id: string
    }

    type GridRow = Record<string, unknown> & { id: unknown }

    type CellAnchor = {
        top: number
        left: number
        width: number
        height: number
    }

    type GridApi = {
        on: (event: string, handler: (event: Record<string, unknown>) => void | boolean | Promise<void | boolean>) => void
        intercept: (event: string, handler: (event: Record<string, unknown>) => void | boolean | Promise<void | boolean>) => void
        exec: (action: string, params?: Record<string, unknown>) => void | Promise<unknown>
    }

    const BOOLEAN_OPTIONS: GridOption[] = [
        { id: NULL_OPTION_VALUE, label: '(None)' },
        { id: 1, label: 'Yes' },
        { id: 0, label: 'No' },
    ]

    let {
        rows = [],
        columns = [],
        primaryKey = 'id',
        tableKey = '',
        tableLoading = false,
        selectedRowId = $bindable<string | number | null>(null),
        onRowSelect,
        onCellUpdate,
    }: {
        rows?: Record<string, unknown>[]
        columns?: ColumnMeta[]
        primaryKey?: string
        tableKey?: string
        tableLoading?: boolean
        selectedRowId?: string | number | null
        onRowSelect?: (rowId: string | number) => void
        onCellUpdate?: (update: {
            rowId: string | number
            column: string
            value: unknown
            row: Record<string, unknown>
        }) => void | Promise<void>
    } = $props()

    let gridApi = $state<GridApi | null>(null)
    let gridRoot = $state<HTMLElement | null>(null)
    let activeIconPicker = $state<{
        rowId: string | number
        column: string
        anchor: CellAnchor
        iconColor: number | null
    } | null>(null)
    let activeColorPicker = $state<{
        rowId: string | number
        column: string
        anchor: CellAnchor
        optional: boolean
        initialValue: unknown
    } | null>(null)
    let activeDateTimePicker = $state<{
        rowId: string | number
        column: string
        anchor: CellAnchor
        optional: boolean
        initialValue: unknown
    } | null>(null)

    setContext<DataTableGridContext>(DATA_TABLE_GRID_CONTEXT, {
        get tableName() {
            return tableKey
        },
        get rows() {
            return rows
        },
        get columns() {
            return columns
        },
    })

    let gridData = $derived(
        rows.map((row: Record<string, unknown>): GridRow => ({
            ...row,
            id: row[primaryKey] ?? row.id,
        })),
    )

    let gridColumns = $derived.by((): GridColumn[] => {
        return columns
            .filter((column: ColumnMeta) => isGridColumn(column))
            .map((column: ColumnMeta) => buildGridColumn(column))
    })

    function formatHeader(name: string): string {
        return name
            .split('_')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ')
    }

    function buildForeignKeyOptions(column: ColumnMeta): GridOption[] {
        const options: GridOption[] = []

        if (!column.notNull) {
            options.push({ id: NULL_OPTION_VALUE, label: '(None)' })
        }

        for (const option of column.referenceOptions ?? []) {
            options.push({
                id: option.id,
                label: option.title,
            })
        }

        return options
    }

    function buildEnumOptions(column: ColumnMeta): GridOption[] {
        return (column.enumOptions ?? []).map((option) => {
            const numericId = Number(option.id)
            return {
                id: Number.isInteger(numericId) ? numericId : option.id,
                label: option.title,
            }
        })
    }

    function buildOptionalGetter(columnName: string) {
        return (row: Record<string, unknown>): string | number => {
            const value = row[columnName]

            if (isNullOptionValue(value)) {
                return NULL_OPTION_VALUE
            }

            if (typeof value === 'string' || typeof value === 'number') {
                return value
            }

            return String(value ?? '')
        }
    }

    function buildOptionalSetter(columnName: string) {
        return (row: Record<string, unknown>, value: unknown) => {
            row[columnName] = normalizeOptionalValue(value)
        }
    }

    function buildGridColumn(column: ColumnMeta): GridColumn {
        const isPrimaryKey = column.name === primaryKey
        const isEditable = column.editable !== false
        const base: GridColumn = {
            id: column.name,
            header: formatHeader(column.name),
            width: isPrimaryKey ? 220 : undefined,
            flexgrow: isPrimaryKey ? undefined : 1,
            hidden: isPrimaryKey && columns.length > 6,
        }

        if (!isEditable) {
            return base
        }

        switch (column.editorKind) {
            case 'foreignKey':
                return {
                    ...base,
                    editor: 'combo',
                    options: buildForeignKeyOptions(column),
                    getter: buildOptionalGetter(column.name),
                    setter: buildOptionalSetter(column.name),
                }
            case 'datetime':
                return {
                    ...base,
                    template: (value) => formatDateTimeValue(value),
                }
            case 'color':
                return {
                    ...base,
                    cell: ColorCell,
                }
            case 'icon':
                return {
                    ...base,
                    cell: IconCell,
                }
            case 'boolean':
                return {
                    ...base,
                    editor: 'richselect',
                    options: BOOLEAN_OPTIONS,
                    getter: buildOptionalGetter(column.name),
                    setter: buildOptionalSetter(column.name),
                }
            case 'enum':
                return {
                    ...base,
                    editor: 'richselect',
                    options: buildEnumOptions(column),
                    getter: buildOptionalGetter(column.name),
                    setter: buildOptionalSetter(column.name),
                }
            case 'number':
                return {
                    ...base,
                    editor: 'text',
                }
            default:
                return {
                    ...base,
                    editor: 'text',
                }
        }
    }

    function getRowValue(rowId: string | number, columnName: string): unknown {
        const row = rows.find(
            (entry) => String(entry[primaryKey] ?? entry.id) === String(rowId),
        )
        return row?.[columnName]
    }

    function locateCellAnchor(rowId: string | number, column: string): CellAnchor | null {
        if (!gridRoot) return null

        const cell = gridRoot.querySelector(
            `[data-row-id="${CSS.escape(String(rowId))}"][data-col-id="${CSS.escape(column)}"]`,
        ) as HTMLElement | null

        if (!cell) return null

        const rect = cell.getBoundingClientRect()
        return {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
        }
    }

    function dismissGridEditor() {
        void gridApi?.exec('close-editor', { ignore: true })
    }

    function closeColorPicker() {
        activeColorPicker = null
        dismissGridEditor()
    }

    function closeDateTimePicker() {
        activeDateTimePicker = null
        dismissGridEditor()
    }

    function closeIconPicker() {
        activeIconPicker = null
        dismissGridEditor()
    }

    async function commitColorSelection(color: number | null) {
        const api = gridApi
        if (!api || !activeColorPicker) return

        const { rowId, column } = activeColorPicker

        await api.exec('update-cell', {
            id: rowId,
            column,
            value: color,
        })
    }

    function openColorPicker(
        rowId: string | number,
        columnMeta: ColumnMeta,
        anchor: CellAnchor,
    ) {
        closeIconPicker()
        closeColorPicker()
        closeDateTimePicker()
        dismissGridEditor()
        activeColorPicker = {
            rowId,
            column: columnMeta.name,
            anchor,
            optional: !columnMeta.notNull,
            initialValue: getRowValue(rowId, columnMeta.name),
        }
    }

    async function commitIconSelection(iconId: string | null) {
        const api = gridApi
        if (!api || !activeIconPicker) return

        const { rowId, column } = activeIconPicker

        await api.exec('update-cell', {
            id: rowId,
            column,
            value: iconId,
        })

        closeIconPicker()
    }

    function openIconPicker(
        rowId: string | number,
        columnMeta: ColumnMeta,
        anchor: CellAnchor,
    ) {
        closeColorPicker()
        closeIconPicker()
        closeDateTimePicker()
        dismissGridEditor()

        const row = rows.find(
            (entry) => String(entry[primaryKey] ?? entry.id) === String(rowId),
        )

        activeIconPicker = {
            rowId,
            column: columnMeta.name,
            anchor,
            iconColor: row ? resolveRowIconColor(row, tableKey, rows) : null,
        }
    }

    async function commitDateTimeSelection(value: string | null) {
        const api = gridApi
        if (!api || !activeDateTimePicker) return

        const { rowId, column } = activeDateTimePicker

        await api.exec('update-cell', {
            id: rowId,
            column,
            value,
        })
    }

    function openDateTimePicker(
        rowId: string | number,
        columnMeta: ColumnMeta,
        anchor: CellAnchor,
    ) {
        closeIconPicker()
        closeColorPicker()
        closeDateTimePicker()
        dismissGridEditor()
        activeDateTimePicker = {
            rowId,
            column: columnMeta.name,
            anchor,
            optional: !columnMeta.notNull,
            initialValue: getRowValue(rowId, columnMeta.name),
        }
    }

    function init(api: GridApi) {
        gridApi = api

        api.intercept('open-editor', (event) => {
            const columnName = String(event.column ?? '')
            const columnMeta = columns.find((entry) => entry.name === columnName)

            if (
                columnMeta?.editorKind !== 'datetime'
                && columnMeta?.editorKind !== 'color'
                && columnMeta?.editorKind !== 'icon'
            ) {
                return
            }

            const anchor = locateCellAnchor(event.id as string | number, columnName)
            if (!anchor) return false

            if (columnMeta.editorKind === 'icon') {
                openIconPicker(event.id as string | number, columnMeta, anchor)
            } else if (columnMeta.editorKind === 'color') {
                openColorPicker(event.id as string | number, columnMeta, anchor)
            } else {
                openDateTimePicker(event.id as string | number, columnMeta, anchor)
            }
            return false
        })

        api.intercept('update-cell', (event) => {
            if (isNullOptionValue(event.value)) {
                event.value = null
            }
        })

        api.on('select-row', (event) => {
            const rowId = event.id as string | number
            selectedRowId = rowId
            onRowSelect?.(rowId)
        })

        api.on('update-cell', async (event) => {
            const rowId = event.id as string | number
            const column = String(event.column)
            const value = normalizeOptionalValue(event.value)

            const row = gridData.find(
                (entry: GridRow) => String(entry.id) === String(rowId),
            )

            if (!row) {
                return
            }

            try {
                await onCellUpdate?.({
                    rowId,
                    column,
                    value,
                    row,
                })
            } catch (error) {
                console.error('Failed to update cell:', error)
                return false
            }
        })
    }
</script>

<div bind:this={gridRoot} class="daisy-table relative h-full min-h-96 rounded-box border border-base-300 bg-base-100 shadow-lg overflow-hidden">
    {#if tableLoading}
        <div class="absolute inset-0 z-10 flex items-center justify-center bg-base-100/70 backdrop-blur-sm">
            <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>
    {/if}

    {#if gridColumns.length > 0}
        {#key tableKey}
            <Grid data={gridData} columns={gridColumns} {init} />
        {/key}
    {:else}
        <div class="flex h-full items-center justify-center text-base-content/60">
            No columns to display
        </div>
    {/if}

    {#if activeColorPicker}
        {@const initialColor = activeColorPicker.initialValue}
        <ColorPickerPopover
                anchor={activeColorPicker.anchor}
                initialValue={initialColor == null || initialColor === '' ? null : Number(initialColor)}
                optional={activeColorPicker.optional}
                onSelect={commitColorSelection}
                onClose={closeColorPicker}
        />
    {/if}

    {#if activeIconPicker}
        <IconPickerPopover
                anchor={activeIconPicker.anchor}
                value={getRowValue(activeIconPicker.rowId, activeIconPicker.column) as string | null}
                iconColor={activeIconPicker.iconColor}
                onSelect={commitIconSelection}
                onClose={closeIconPicker}
        />
    {/if}

    {#if activeDateTimePicker}
        <DateTimePickerPopover
                anchor={activeDateTimePicker.anchor}
                initialValue={activeDateTimePicker.initialValue}
                optional={activeDateTimePicker.optional}
                onSelect={commitDateTimeSelection}
                onClose={closeDateTimePicker}
        />
    {/if}
</div>

<style>
    .daisy-table {
        /* Surfaces */
        --wx-background: oklch(var(--b1));
        --wx-background-alt: oklch(var(--b2));
        --wx-color: oklch(var(--bc));
        --wx-color-font: oklch(var(--bc));
        --wx-background-hover: oklch(var(--b3));
        --wx-input-font-color: oklch(var(--bc));

        /* SVAR popup / dropdown surfaces */
        --wx-popup-background: oklch(var(--b1));
        --wx-popup-shadow: 0 4px 20px oklch(var(--bc) / 0.12);
        --wx-popup-border: 1px solid oklch(var(--bc) / 0.14);
        --wx-popup-border-radius: 0.5rem;
        --wx-color-primary: oklch(var(--p));

        /* Selection – primary tint, base-content text */
        --wx-table-select-background: color-mix(in oklch, oklch(var(--p)) 22%, oklch(var(--b2)));
        --wx-table-select-focus-background: color-mix(in oklch, oklch(var(--p)) 32%, oklch(var(--b2)));
        --wx-table-select-color: oklch(var(--bc));
        --wx-table-select-border: inset 3px 0 oklch(var(--p));

        /* Chrome */
        --wx-table-border: 1px solid oklch(var(--bc) / 0.14);
        --wx-table-header-border: var(--wx-table-border);
        --wx-table-header-cell-border: var(--wx-table-border);
        --wx-table-footer-cell-border: var(--wx-table-border);
        --wx-table-cell-border: var(--wx-table-border);
        --wx-header-font-weight: 600;
        --wx-table-header-background: oklch(var(--b2));
        --wx-table-fixed-column-border: 3px solid oklch(var(--bc) / 0.12);
        --wx-table-editor-dropdown-border: 1px solid oklch(var(--bc) / 0.14);
        --wx-table-editor-dropdown-shadow: 0 4px 20px oklch(var(--bc) / 0.12);
        --wx-table-drag-over-background: oklch(var(--b3));
        --wx-table-drag-zone-shadow: 0 4px 20px oklch(var(--bc) / 0.12);
    }

    .daisy-table :global(.wx-cell.wx-editor) {
        overflow: visible;
        z-index: 4;
    }

    .daisy-table :global(.wx-dropdown) {
        background-color: oklch(var(--b1)) !important;
        color: oklch(var(--bc));
        border: 1px solid oklch(var(--bc) / 0.14);
        box-shadow: 0 4px 20px oklch(var(--bc) / 0.12);
        min-width: 100%;
        z-index: 20;
    }

    .daisy-table :global(.wx-list) {
        background-color: oklch(var(--b1));
        color: oklch(var(--bc));
    }

    .daisy-table :global(.wx-item) {
        background-color: oklch(var(--b1));
        color: oklch(var(--bc));
    }

    .daisy-table :global(.wx-item.wx-focus) {
        background-color: oklch(var(--b3));
    }

    .daisy-table :global(.wx-no-data) {
        background-color: oklch(var(--b1));
        color: oklch(var(--bc) / 0.6);
    }

    .daisy-table :global(.wx-input) {
        background: oklch(var(--b1));
        color: oklch(var(--bc));
    }

    .daisy-table :global(.row.selected .cell),
    .daisy-table :global(.wx-row.selected .wx-cell) {
        background-color: var(--wx-table-select-background);
        color: var(--wx-table-select-color);
    }

    .daisy-table :global(.row.selected:focus-within .cell),
    .daisy-table :global(.wx-row.selected:focus-within .wx-cell) {
        background-color: var(--wx-table-select-focus-background);
        color: var(--wx-table-select-color);
    }

    .daisy-table :global(.row:hover:not(.selected) .cell),
    .daisy-table :global(.wx-row:hover:not(.selected) .wx-cell) {
        background-color: oklch(var(--b3));
        color: oklch(var(--bc));
    }

    .daisy-table :global(.wx-table-menu) {
        box-shadow: 0 4px 20px oklch(var(--bc) / 0.12);
        outline: 1px solid oklch(var(--bc) / 0.14);
    }
</style>
