<script lang="ts">
    import { onMount } from 'svelte'
    import { Plus, Trash2 } from 'lucide-svelte'

    import DataTableGrid from '$lib/components/DataTableGrid.svelte'
    import TableTab from '$lib/components/TableTab.svelte'
    import TaskEditor from '$lib/components/TaskEditor.svelte'
    import {
        deleteTableRow,
        fetchTableRows,
        getPrimaryKeyColumn,
        getTableColumns,
        insertTableRow,
        listTables,
        loadDomainOptions,
        loadTaskOptions,
        loadTaskRecord,
        loadTaskDependencyEdges,
        recordToTask,
        saveTaskRecord,
        taskHasChildren,
        updateTableCell,
        type TaskRef,
        type TaskRecord,
        type TaskDependencyEdge,
    } from '$lib/db/dataView'
    import { loadTaskStatusMachine, loadTaskStatusOptions, type TaskStatusEdgeRecord } from '$lib/db/taskStatusMachine'
    import { closeInspector, openInspector, updateInspectorProps } from '$lib/inspector.svelte'
    import {
        beginTaskInspectorSession,
        navigateToRelatedTask,
    } from '$lib/taskInspectorNav.svelte'
    import type { ColumnMeta } from '$lib/tableRendering'

    let tables = $state<string[]>([])
    let activeTable = $state<string | null>(null)
    let columns = $state<ColumnMeta[]>([])
    let rows = $state<Record<string, unknown>[]>([])
    let primaryKey = $state('id')
    let selectedRowId = $state<string | number | null>(null)
    let loading = $state(true)
    let tableLoading = $state(false)
    let error = $state<string | null>(null)
    let showDeleteConfirm = $state(false)
    let actionLoading = $state(false)
    let loadGeneration = 0

    let domains = $state<{ id: string; title: string; color?: number | null }[]>([])
    let taskOptions = $state<TaskRef[]>([])
    let statusOptions = $state<{ id: string; title: string; is_initial?: boolean }[]>([])
    let statusEdges = $state<TaskStatusEdgeRecord[]>([])
    let taskDependencies = $state<TaskDependencyEdge[]>([])

    let selectedRowLabel = $derived.by(() => {
        if (selectedRowId == null) return null
        const row = rows.find((entry) => entry[primaryKey] === selectedRowId)
        if (!row) return String(selectedRowId)

        const labelField = row.title ?? row.name ?? row.description
        return labelField ? String(labelField) : String(selectedRowId)
    })

    async function loadTables() {
        loading = true
        error = null

        try {
            tables = await listTables()
            if (!activeTable && tables.length > 0) {
                await selectTable(tables[0], { initial: true })
            } else if (activeTable && !tables.includes(activeTable)) {
                await selectTable(tables[0] ?? null, { initial: true })
            }
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to load tables'
        } finally {
            loading = false
        }
    }

    async function selectTable(tableName: string | null, options: { initial?: boolean } = {}) {
        if (!tableName) {
            activeTable = null
            rows = []
            columns = []
            selectedRowId = null
            return
        }

        if (!options.initial && tableName !== 'task') {
            closeInspector()
        }

        activeTable = tableName
        await loadTableData(tableName)
    }

    async function loadTableData(tableName: string) {
        const generation = ++loadGeneration
        tableLoading = true
        error = null
        selectedRowId = null

        if (tableName !== 'task') {
            closeInspector()
        }

        try {
            primaryKey = await getPrimaryKeyColumn(tableName)
            const result = await fetchTableRows(tableName)

            if (generation !== loadGeneration) {
                return
            }

            columns = result.columns
            rows = result.rows
        } catch (err) {
            if (generation !== loadGeneration) {
                return
            }

            error = err instanceof Error ? err.message : `Failed to load ${tableName}`
        } finally {
            if (generation === loadGeneration) {
                tableLoading = false
            }
        }
    }

    async function refreshTaskContext() {
        const [loadedDomains, loadedTasks, loadedStatuses, machine, loadedDependencies] = await Promise.all([
            loadDomainOptions(),
            loadTaskOptions(),
            loadTaskStatusOptions(),
            loadTaskStatusMachine(),
            loadTaskDependencyEdges(),
        ])
        domains = loadedDomains
        taskOptions = loadedTasks
        statusOptions = loadedStatuses
        statusEdges = machine.edges
        taskDependencies = loadedDependencies
    }

    async function inspectTaskById(taskId: string) {
        await refreshTaskContext()

        const row = rows.find((entry) => String(entry.id) === taskId)
        const taskRecord = row
            ? recordToTask(row)
            : await loadTaskRecord(taskId)
        if (!taskRecord) return

        const hasChildren = await taskHasChildren(taskId)

        updateInspectorProps({
            task: taskRecord,
            domains,
            tasks: taskOptions,
            statuses: statusOptions,
            statusEdges,
            taskDependencies,
            hasChildren,
            onChildrenChange: () => handleChildrenChange(taskId),
            onDependenciesChange: () => handleDependenciesChange(taskId),
            onInspectTask: (childTaskId: string) => void navigateToRelatedTask(childTaskId),
        })
    }

    async function openTaskInspector(row: Record<string, unknown>) {
        try {
            const taskRecord = recordToTask(row)

            const hasChildren = await taskHasChildren(taskRecord.id)
            await refreshTaskContext()

            beginTaskInspectorSession(inspectTaskById)

            openInspector(
                TaskEditor,
                {
                    task: taskRecord,
                    domains,
                    tasks: taskOptions,
                    statuses: statusOptions,
                    statusEdges,
                    taskDependencies,
                    hasChildren,
                    onSave: handleTaskSave,
                    onDelete: handleTaskDelete,
                    onChildrenChange: () => handleChildrenChange(taskRecord.id),
                    onDependenciesChange: () => handleDependenciesChange(taskRecord.id),
                    onInspectTask: (childTaskId: string) => void navigateToRelatedTask(childTaskId),
                },
                'Task Inspector',
            )
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to open task inspector'
        }
    }

    async function handleTaskSave(updatedTask: TaskRecord) {
        await saveTaskRecord(updatedTask)

        if (activeTable === 'task') {
            rows = rows.map((row) =>
                String(row.id) === updatedTask.id ? { ...row, ...updatedTask } : row,
            )
            await refreshTaskContext()
        }

        updateInspectorProps({
            statusEdges,
        })
    }

    async function handleChildrenChange(taskId: string) {
        const childCount = await taskHasChildren(taskId)
        await refreshTaskContext()
        updateInspectorProps({ hasChildren: childCount, tasks: taskOptions })
    }

    async function handleDependenciesChange(_taskId: string) {
        await refreshTaskContext()
        updateInspectorProps({ taskDependencies, tasks: taskOptions })
    }

    async function handleTaskDelete(taskId: string) {
        await deleteTableRow('task', taskId)
        rows = rows.filter((row) => String(row.id) !== taskId)

        if (selectedRowId != null && String(selectedRowId) === taskId) {
            selectedRowId = null
        }

        closeInspector()
        await refreshTaskContext()
    }

    async function handleRowSelect(rowId: string | number) {
        if (activeTable !== 'task') return

        const row = rows.find(
            (entry) => entry[primaryKey] === rowId || entry.id === rowId,
        )
        if (row) {
            await openTaskInspector(row)
        }
    }

    async function handleCellUpdate(update: {
        rowId: string | number
        column: string
        value: unknown
    }) {
        if (!activeTable) return

        const value = update.value
        const columnMeta = columns.find((entry) => entry.name === update.column)

        await updateTableCell(activeTable, update.rowId, update.column, value)

        rows = rows.map((row) =>
            String(row[primaryKey]) === String(update.rowId)
                ? { ...row, [update.column]: value }
                : row,
        )

        if (columnMeta?.editorKind === 'foreignKey' || columnMeta?.refTable === activeTable) {
            columns = await getTableColumns(activeTable)
        }
    }

    async function handleAddRow() {
        if (!activeTable || actionLoading) return

        actionLoading = true
        error = null

        try {
            const newRow = await insertTableRow(activeTable)
            rows = [...rows, newRow]
            selectedRowId = newRow[primaryKey] as string | number

            if (activeTable === 'task') {
                await refreshTaskContext()
                await openTaskInspector(newRow)
            }

            if (['domain', 'task', 'aftermath'].includes(activeTable)) {
                columns = await getTableColumns(activeTable)
            }
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to add entry'
        } finally {
            actionLoading = false
        }
    }

    function requestDeleteRow() {
        if (selectedRowId == null) return
        showDeleteConfirm = true
    }

    async function confirmDeleteRow() {
        if (!activeTable || selectedRowId == null || actionLoading) return

        actionLoading = true
        error = null
        showDeleteConfirm = false

        try {
            const deletedId = selectedRowId
            await deleteTableRow(activeTable, deletedId)
            rows = rows.filter((row) => row[primaryKey] !== deletedId)
            selectedRowId = null

            if (activeTable === 'task') {
                closeInspector()
                await refreshTaskContext()
            }
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to delete entry'
        } finally {
            actionLoading = false
        }
    }

    onMount(async () => {
        await refreshTaskContext()
        await loadTables()
    })
</script>

<div class="flex h-full min-h-0 flex-col bg-base-200">
    <div class="sticky top-0 z-30 border-b border-base-300 bg-base-200/95 px-4 py-3 backdrop-blur">
        <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm font-semibold uppercase tracking-wide text-base-content/60 mr-2">
                Tables
            </span>

            {#each tables as table (table)}
                <TableTab
                        label={table}
                        active={activeTable === table}
                        onclick={() => {
                            void selectTable(table)
                        }}
                />
            {/each}
        </div>
    </div>

    <div class="flex min-h-0 flex-1 flex-col p-4">
        {#if loading && !activeTable}
            <div class="flex h-64 items-center justify-center">
                <span class="loading loading-spinner loading-lg text-primary"></span>
            </div>
        {:else if error && rows.length === 0}
            <div class="alert alert-error max-w-2xl">
                <span>{error}</span>
            </div>
        {:else if activeTable}
            {#if error}
                <div class="alert alert-error mb-4 max-w-2xl">
                    <span>{error}</span>
                </div>
            {/if}

            <div class="mb-3 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 class="text-2xl font-bold capitalize">{activeTable}</h1>
                    <p class="mt-1 text-sm text-base-content/60">
                        Double-click a cell to edit inline.
                        {#if activeTable === 'task'}
                            Click a row to open the task inspector.
                        {:else}
                            Select a row before deleting it.
                        {/if}
                    </p>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                    {#if selectedRowLabel}
                        <span class="badge badge-outline max-w-xs truncate">
                            Selected: {selectedRowLabel}
                        </span>
                    {/if}

                    <button
                            type="button"
                            class="btn btn-primary btn-sm gap-2"
                            onclick={handleAddRow}
                            disabled={actionLoading}
                    >
                        <Plus class="h-4 w-4" />
                        Add entry
                    </button>

                    <button
                            type="button"
                            class="btn btn-error btn-sm gap-2"
                            onclick={requestDeleteRow}
                            disabled={actionLoading || selectedRowId == null}
                    >
                        <Trash2 class="h-4 w-4" />
                        Delete entry
                    </button>
                </div>
            </div>

            <div class="min-h-0 flex-1">
                <DataTableGrid
                        {rows}
                        {columns}
                        {primaryKey}
                        tableKey={activeTable}
                        {tableLoading}
                        bind:selectedRowId
                        onRowSelect={handleRowSelect}
                        onCellUpdate={handleCellUpdate}
                />
            </div>
        {:else}
            <div class="alert alert-info max-w-xl">
                <span>No tables found in the database.</span>
            </div>
        {/if}
    </div>
</div>

{#if showDeleteConfirm}
    <dialog class="modal modal-open">
        <div class="modal-box">
            <h3 class="text-lg font-bold">Delete entry?</h3>
            <p class="py-4 text-base-content/70">
                {#if selectedRowLabel}
                    This will permanently delete <span class="font-semibold">{selectedRowLabel}</span>
                    from {activeTable}.
                {:else}
                    This will permanently delete the selected row from {activeTable}.
                {/if}
            </p>
            <div class="modal-action">
                <button type="button" class="btn btn-ghost" onclick={() => (showDeleteConfirm = false)}>
                    Cancel
                </button>
                <button
                        type="button"
                        class="btn btn-error"
                        onclick={confirmDeleteRow}
                        disabled={actionLoading}
                >
                    Delete
                </button>
            </div>
        </div>
        <form method="dialog" class="modal-backdrop">
            <button type="button" onclick={() => (showDeleteConfirm = false)}>close</button>
        </form>
    </dialog>
{/if}
