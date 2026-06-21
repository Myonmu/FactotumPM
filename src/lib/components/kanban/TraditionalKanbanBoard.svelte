<script lang="ts">
    import { onMount } from 'svelte'

    import KanbanCard from '$lib/components/kanban/KanbanCard.svelte'
    import KanbanColumn from '$lib/components/kanban/KanbanColumn.svelte'
    import TaskEditor from '$lib/components/TaskEditor.svelte'
    import {
        deleteTableRow,
        fetchTableRows,
        insertTableRow,
        loadDomainOptions,
        loadTaskOptions,
        loadTaskRecord,
        loadTaskDependencyEdges,
        moveTaskToStatus,
        recordToTask,
        saveTaskRecord,
        taskHasChildren,
        type TaskRef,
        type TaskRecord,
        type TaskDependencyEdge,
    } from '$lib/db/dataView'
    import {
        loadTaskStatusMachine,
        loadTaskStatusOptions,
        isTerminalStatus,
        updateTaskStatus,
        type TaskStatusEdgeRecord,
        type TaskStatusRecord,
    } from '$lib/db/taskStatusMachine'
    import { closeInspector, openInspector, syncInspectedTask, updateInspectorProps } from '$lib/inspector.svelte'
    import {
        beginTaskInspectorSession,
        navigateToRelatedTask,
    } from '$lib/taskInspectorNav.svelte'
    import { findStatusIdAtPoint } from '$lib/kanban/dragUtils'
    import { groupTasksByStatus } from '$lib/kanban/groupTasksByStatus'
    import type { KanbanFilterRoot } from '$lib/kanban/filterTypes'
    import { loadAllColumnFilterConfigs, saveColumnFilterConfig } from '$lib/kanban/kanbanFilterPrefs'
    import { setKanbanDragging } from '$lib/kanban/kanbanDrag.svelte'
    import { loadAllColumnSortConfigs, saveColumnSortConfig } from '$lib/kanban/columnSortPrefs'
    import type { ColumnSortConfig } from '$lib/kanban/types'
    import {
        applyKanbanGlobalFilters,
        DEFAULT_KANBAN_GLOBAL_FILTERS,
        resolveColumnFilter,
        resolveColumnSort,
        type KanbanGlobalFilters,
    } from '$lib/kanban/kanbanGlobalFilters'
    import {
        applyPosUpdatesToStatuses,
        buildTraditionalColumnPosUpdates,
        reorderStatusesById,
    } from '$lib/kanban/traditionalColumnOrder'

    let {
        globalFilters = DEFAULT_KANBAN_GLOBAL_FILTERS,
    }: {
        globalFilters?: KanbanGlobalFilters
    } = $props()

    function sqliteTimestamp(): string {
        return new Date().toISOString().replace('T', ' ').slice(0, 19)
    }

    let statuses = $state<TaskStatusRecord[]>([])
    let tasks = $state<TaskRecord[]>([])
    let domains = $state<{ id: string; title: string; color?: number | null }[]>([])
    let taskOptions = $state<TaskRef[]>([])
    let statusOptions = $state<{ id: string; title: string; is_initial?: boolean }[]>([])
    let statusEdges = $state<TaskStatusEdgeRecord[]>([])
    let taskDependencies = $state<TaskDependencyEdge[]>([])
    let columnSorts = $state<Record<string, ColumnSortConfig>>({})
    let columnFilters = $state<Record<string, KanbanFilterRoot>>({})
    let draggingTaskId = $state<string | null>(null)
    let draggingColumnId = $state<string | null>(null)
    let columnReorderHoverId = $state<string | null>(null)
    let hoverStatusId = $state<string | null>(null)
    let dragPosition = $state({ x: 0, y: 0 })
    let loading = $state(true)
    let error = $state<string | null>(null)
    let actionLoading = $state(false)

    const sortedStatuses = $derived(
        [...statuses].sort((left, right) => left.pos_x - right.pos_x || left.name.localeCompare(right.name)),
    )

    const boardTasks = $derived(applyKanbanGlobalFilters(tasks, globalFilters))

    const draggingTask = $derived(
        draggingTaskId ? boardTasks.find((task) => task.id === draggingTaskId) ?? null : null,
    )

    const taskCountsByStatus = $derived.by(() => {
        const counts = new Map<string, number>()
        for (const status of sortedStatuses) {
            counts.set(status.id, 0)
        }

        for (const task of boardTasks) {
            const statusId = task.task_status_id
            if (statusId && counts.has(statusId)) {
                counts.set(statusId, (counts.get(statusId) ?? 0) + 1)
                continue
            }

            const fallbackStatusId = sortedStatuses[0]?.id
            if (fallbackStatusId) {
                counts.set(fallbackStatusId, (counts.get(fallbackStatusId) ?? 0) + 1)
            }
        }

        return counts
    })

    const tasksByStatus = $derived(
        groupTasksByStatus(statuses, boardTasks, columnSorts, columnFilters, globalFilters),
    )

    const draggingTaskDimmed = $derived.by(() => {
        if (!draggingTask?.task_status_id) return false
        const status = statuses.find((entry) => entry.id === draggingTask.task_status_id)
        return isTerminalStatus(status)
    })

    const dropHighlightByStatus = $derived.by(() => {
        const highlights = new Map<string, 'allowed' | null>()
        if (!draggingTaskId || !hoverStatusId) {
            return highlights
        }

        highlights.set(hoverStatusId, 'allowed')
        return highlights
    })

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

    async function loadBoard() {
        loading = true
        error = null

        try {
            const [{ statuses: loadedStatuses, edges: loadedEdges }, taskResult] = await Promise.all([
                loadTaskStatusMachine(),
                fetchTableRows('task'),
            ])

            statuses = loadedStatuses
            statusEdges = loadedEdges
            tasks = taskResult.rows.map(recordToTask)
            columnSorts = await loadAllColumnSortConfigs(loadedStatuses.map((status) => status.id))
            columnFilters = await loadAllColumnFilterConfigs(loadedStatuses.map((status) => status.id))
            await refreshTaskContext()
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to load Kanban board'
        } finally {
            loading = false
        }
    }

    async function handleSortChange(statusId: string, rules: ColumnSortConfig) {
        columnSorts = {
            ...columnSorts,
            [statusId]: rules,
        }
        await saveColumnSortConfig(statusId, rules)
    }

    async function handleFilterChange(statusId: string, filter: KanbanFilterRoot) {
        columnFilters = {
            ...columnFilters,
            [statusId]: filter,
        }
        await saveColumnFilterConfig(statusId, filter)
    }

    function handleColumnDragStart(event: PointerEvent, statusId: string) {
        if (draggingTaskId || actionLoading) return

        event.preventDefault()
        event.stopPropagation()

        draggingColumnId = statusId
        columnReorderHoverId = statusId

        document.body.style.userSelect = 'none'
        document.body.style.cursor = 'grabbing'

        function handlePointerMove(moveEvent: PointerEvent) {
            columnReorderHoverId = findStatusIdAtPoint(moveEvent.clientX, moveEvent.clientY)
        }

        function handlePointerUp(upEvent: PointerEvent) {
            window.removeEventListener('pointermove', handlePointerMove)
            window.removeEventListener('pointerup', handlePointerUp)

            document.body.style.userSelect = ''
            document.body.style.cursor = ''

            const sourceId = draggingColumnId
            const targetId = findStatusIdAtPoint(upEvent.clientX, upEvent.clientY)

            draggingColumnId = null
            columnReorderHoverId = null

            if (!sourceId || !targetId || sourceId === targetId) return

            void handleColumnReorder(sourceId, targetId)
        }

        window.addEventListener('pointermove', handlePointerMove)
        window.addEventListener('pointerup', handlePointerUp)
    }

    async function handleColumnReorder(fromId: string, toId: string) {
        const currentOrder = sortedStatuses
        const reordered = reorderStatusesById(currentOrder, fromId, toId)
        const updates = buildTraditionalColumnPosUpdates(reordered).filter((update) => {
            const status = statuses.find((entry) => entry.id === update.id)
            return status != null && status.pos_x !== update.pos_x
        })

        if (updates.length === 0) return

        statuses = applyPosUpdatesToStatuses(statuses, updates)
        error = null

        try {
            await Promise.all(
                updates.map((update) => updateTaskStatus(update.id, { pos_x: update.pos_x })),
            )
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to save column order'
            await loadBoard()
        }
    }

    function handlePointerDragStart(event: PointerEvent, taskId: string) {
        if (draggingColumnId) return
        setKanbanDragging(true)
        draggingTaskId = taskId
        dragPosition = { x: event.clientX, y: event.clientY }
        hoverStatusId = findStatusIdAtPoint(event.clientX, event.clientY)

        document.body.style.userSelect = 'none'
        document.body.style.cursor = 'grabbing'

        function handlePointerMove(moveEvent: PointerEvent) {
            dragPosition = { x: moveEvent.clientX, y: moveEvent.clientY }
            hoverStatusId = findStatusIdAtPoint(moveEvent.clientX, moveEvent.clientY)
        }

        async function handlePointerUp(upEvent: PointerEvent) {
            window.removeEventListener('pointermove', handlePointerMove)
            window.removeEventListener('pointerup', handlePointerUp)

            document.body.style.userSelect = ''
            document.body.style.cursor = ''
            setKanbanDragging(false)

            const targetStatusId = findStatusIdAtPoint(upEvent.clientX, upEvent.clientY)
            const sourceTaskId = draggingTaskId

            draggingTaskId = null
            hoverStatusId = null

            if (!sourceTaskId || !targetStatusId) return

            await handleDropTask(sourceTaskId, targetStatusId)
        }

        window.addEventListener('pointermove', handlePointerMove)
        window.addEventListener('pointerup', handlePointerUp)
    }

    async function handleDropTask(taskId: string, targetStatusId: string) {
        const task = tasks.find((entry) => entry.id === taskId)
        if (!task || actionLoading) return

        if (task.task_status_id === targetStatusId) {
            return
        }

        actionLoading = true
        error = null

        try {
            await moveTaskToStatus(taskId, targetStatusId)
            const movedAt = sqliteTimestamp()
            const updatedTask = {
                ...task,
                task_status_id: targetStatusId,
                updated_at: movedAt,
            }
            tasks = tasks.map((entry) =>
                entry.id === taskId ? updatedTask : entry,
            )
            syncInspectedTask(updatedTask, { statusEdges })
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to move task'
        } finally {
            actionLoading = false
        }
    }

    async function inspectTaskById(taskId: string) {
        await refreshTaskContext()

        const taskRecord =
            tasks.find((entry) => entry.id === taskId) ?? (await loadTaskRecord(taskId))
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

    async function openTaskInspector(task: TaskRecord) {
        try {
            const hasChildren = await taskHasChildren(task.id)
            await refreshTaskContext()

            beginTaskInspectorSession(inspectTaskById)

            openInspector(
                TaskEditor,
                {
                    task,
                    domains,
                    tasks: taskOptions,
                    statuses: statusOptions,
                    statusEdges,
                    taskDependencies,
                    hasChildren,
                    onSave: handleTaskSave,
                    onDelete: handleTaskDelete,
                    onChildrenChange: () => handleChildrenChange(task.id),
                    onDependenciesChange: () => handleDependenciesChange(task.id),
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
        tasks = tasks.map((task) => (task.id === updatedTask.id ? updatedTask : task))
        await refreshTaskContext()
        updateInspectorProps({ statusEdges })
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
        tasks = tasks.filter((task) => task.id !== taskId)
        closeInspector()
        await refreshTaskContext()
    }

    async function handleAddTask(statusId: string) {
        if (actionLoading) return

        actionLoading = true
        error = null

        try {
            const newRow = await insertTableRow('task')
            const newTask = recordToTask(newRow)

            if (newTask.task_status_id !== statusId) {
                await moveTaskToStatus(newTask.id, statusId)
                newTask.task_status_id = statusId
            }

            tasks = [...tasks, newTask]
            await refreshTaskContext()
            await openTaskInspector(newTask)
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to add task'
        } finally {
            actionLoading = false
        }
    }

    onMount(() => {
        void loadBoard()
    })
</script>

<div class="flex h-full min-h-0 flex-col">
{#if loading}
    <div class="flex flex-1 items-center justify-center">
        <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>
{:else if error && tasks.length === 0 && statuses.length === 0}
    <div class="alert alert-error max-w-2xl">
        <span>{error}</span>
    </div>
{:else if sortedStatuses.length === 0}
    <div class="alert alert-info max-w-xl">
        <span>No task statuses configured. Add statuses on the Statuses page first.</span>
    </div>
{:else}
    {#if error}
        <div class="alert alert-error mb-4 max-w-2xl shrink-0">
            <span>{error}</span>
        </div>
    {/if}

    <div class="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-4">
        {#each sortedStatuses as status (status.id)}
            {@const columnTasks = tasksByStatus.get(status.id) ?? []}
            <KanbanColumn
                    {status}
                    tasks={columnTasks}
                    totalTaskCount={taskCountsByStatus.get(status.id) ?? 0}
                    sortRules={resolveColumnSort(status.id, columnSorts, globalFilters)}
                    filterRules={resolveColumnFilter(status.id, columnFilters, globalFilters)}
                    filterDisabled={globalFilters.useGlobalColumnFilter}
                    sortDisabled={globalFilters.useGlobalColumnSort}
                    isColumnDragging={draggingColumnId === status.id}
                    columnReorderTarget={columnReorderHoverId === status.id && draggingColumnId !== status.id}
                    onColumnDragStart={handleColumnDragStart}
                    domains={domains}
                    draggingTaskId={draggingTaskId}
                    dropHighlight={dropHighlightByStatus.get(status.id) ?? null}
                    onSortChange={(rules) => void handleSortChange(status.id, rules)}
                    onFilterChange={(filter) => void handleFilterChange(status.id, filter)}
                    onPointerDragStart={handlePointerDragStart}
                    onCardClick={(task) => void openTaskInspector(task)}
                    onAddTask={(statusId) => void handleAddTask(statusId)}
            />
        {/each}
    </div>
{/if}
</div>

{#if draggingTask}
    <div
            class="pointer-events-none fixed z-[100] w-64 -translate-x-1/2 -translate-y-1/2 opacity-90"
            style:left="{dragPosition.x}px"
            style:top="{dragPosition.y}px"
    >
        <KanbanCard task={draggingTask} {domains} dragging={true} dimmed={draggingTaskDimmed} />
    </div>
{/if}
