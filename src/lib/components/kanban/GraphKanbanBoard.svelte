<script lang="ts">
    import { onMount, tick } from 'svelte'
    import {
        Background,
        BackgroundVariant,
        Controls,
        MiniMap,
        Panel,
        SvelteFlow,
        type Edge,
        type Node,
    } from '@xyflow/svelte'
    import '@xyflow/svelte/dist/style.css'
    import { RefreshCw } from 'lucide-svelte'

    import KanbanCard from '$lib/components/kanban/KanbanCard.svelte'
    import KanbanColumnNode from '$lib/components/kanban/KanbanColumnNode.svelte'
    import StatusTransitionEdge from '$lib/components/StatusTransitionEdge.svelte'
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
        updateTaskStatusKanbanPosition,
        type TaskStatusEdgeRecord,
        type TaskStatusRecord,
    } from '$lib/db/taskStatusMachine'
    import { colorIntToHex } from '$lib/grid/colorUtils'
    import { closeInspector, openInspector, syncInspectedTask, updateInspectorProps } from '$lib/inspector.svelte'
    import {
        beginTaskInspectorSession,
        navigateToRelatedTask,
    } from '$lib/taskInspectorNav.svelte'
    import { findStatusIdAtPoint } from '$lib/kanban/dragUtils'
    import type { KanbanFilterRoot } from '$lib/kanban/filterTypes'
    import { loadAllColumnFilterConfigs, saveColumnFilterConfig } from '$lib/kanban/kanbanFilterPrefs'
    import { setKanbanDragging } from '$lib/kanban/kanbanDrag.svelte'
    import { loadAllColumnSortConfigs, saveColumnSortConfig } from '$lib/kanban/columnSortPrefs'
    import { loadAllColumnHeights, saveColumnHeight } from '$lib/kanban/kanbanColumnHeightPrefs'
    import { groupTasksByStatus } from '$lib/kanban/groupTasksByStatus'
    import {
        applyStatusFlowParallelOffsets,
        buildStatusFlowEdges,
        statusFlowDefaultEdgeOptions,
    } from '$lib/kanban/statusFlowEdges'
    import { DEFAULT_COLUMN_SORT } from '$lib/kanban/taskOrderFields'
    import type { ColumnSortConfig } from '$lib/kanban/types'
    import {
        applyKanbanGlobalFilters,
        DEFAULT_KANBAN_GLOBAL_FILTERS,
        loadKanbanGlobalFilters,
        resolveColumnFilter,
        resolveColumnSort,
        type KanbanGlobalFilters,
    } from '$lib/kanban/kanbanGlobalFilters'

    let {
        filterTaskIds = null,
        embedded = false,
        globalFilters,
        onTaskStatusChange,
    }: {
        filterTaskIds?: string[] | null
        embedded?: boolean
        globalFilters?: KanbanGlobalFilters
        onTaskStatusChange?: (
            taskId: string,
            newStatusId: string,
        ) => void | Promise<void>
    } = $props()

    const nodeTypes = { kanbanColumn: KanbanColumnNode }
    const edgeTypes = { statusTransition: StatusTransitionEdge }

    function sqliteTimestamp(): string {
        return new Date().toISOString().replace('T', ' ').slice(0, 19)
    }

    let nodes = $state.raw<Node[]>([])
    let edges = $state.raw<Edge[]>([])
    let statuses = $state<TaskStatusRecord[]>([])
    let statusEdges = $state<TaskStatusEdgeRecord[]>([])
    let taskDependencies = $state<TaskDependencyEdge[]>([])
    let tasks = $state<TaskRecord[]>([])
    let domains = $state<{ id: string; title: string; color?: number | null }[]>([])
    let taskOptions = $state<TaskRef[]>([])
    let statusOptions = $state<{ id: string; title: string; is_initial?: boolean }[]>([])
    let columnSorts = $state<Record<string, ColumnSortConfig>>({})
    let columnFilters = $state<Record<string, KanbanFilterRoot>>({})
    let columnHeights = $state<Record<string, number>>({})
    let draggingTaskId = $state<string | null>(null)
    let hoverStatusId = $state<string | null>(null)
    let dragPosition = $state({ x: 0, y: 0 })
    let loading = $state(true)
    let error = $state<string | null>(null)
    let actionLoading = $state(false)

    let storedGlobalFilters = $state<KanbanGlobalFilters>({ ...DEFAULT_KANBAN_GLOBAL_FILTERS })

    const effectiveGlobalFilters = $derived(globalFilters ?? storedGlobalFilters)

    const boardTasks = $derived(applyKanbanGlobalFilters(tasks, effectiveGlobalFilters))

    const draggingTask = $derived(
        draggingTaskId ? boardTasks.find((task) => task.id === draggingTaskId) ?? null : null,
    )

    const visibleTasks = $derived.by(() => {
        if (!filterTaskIds || filterTaskIds.length === 0) return boardTasks
        const allowed = new Set(filterTaskIds)
        return boardTasks.filter((task) => allowed.has(task.id))
    })

    const taskCountsByStatus = $derived.by(() => {
        const counts = new Map<string, number>()
        for (const status of statuses) {
            counts.set(status.id, 0)
        }

        for (const task of visibleTasks) {
            const statusId = task.task_status_id
            if (statusId && counts.has(statusId)) {
                counts.set(statusId, (counts.get(statusId) ?? 0) + 1)
                continue
            }

            const fallbackStatusId = statuses[0]?.id
            if (fallbackStatusId) {
                counts.set(fallbackStatusId, (counts.get(fallbackStatusId) ?? 0) + 1)
            }
        }

        return counts
    })

    const draggingTaskDimmed = $derived.by(() => {
        if (!draggingTask?.task_status_id) return false
        const status = statuses.find((entry) => entry.id === draggingTask.task_status_id)
        return isTerminalStatus(status)
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

    function buildNodeData(status: TaskStatusRecord, statusTasks: TaskRecord[]) {
        return {
            label: status.name,
            description: status.description,
            isInitial: status.is_initial === 1,
            isTerminal: status.is_terminal === 1,
            statusColor: colorIntToHex(status.color),
            tasks: statusTasks,
            totalTaskCount: taskCountsByStatus.get(status.id) ?? 0,
            sortRules: resolveColumnSort(status.id, columnSorts, effectiveGlobalFilters),
            filterRules: resolveColumnFilter(status.id, columnFilters, effectiveGlobalFilters),
            filterDisabled: effectiveGlobalFilters.useGlobalColumnFilter,
            sortDisabled: effectiveGlobalFilters.useGlobalColumnSort,
            isDropTarget: hoverStatusId === status.id && draggingTaskId != null,
            draggingTaskId,
            domains,
            showControls: !embedded,
            onSortChange: embedded
                ? undefined
                : (rules: ColumnSortConfig) => {
                      void handleSortChange(status.id, rules)
                  },
            onFilterChange: embedded
                ? undefined
                : (filter: KanbanFilterRoot) => {
                      void handleFilterChange(status.id, filter)
                  },
            onPointerDragStart: handlePointerDragStart,
            onCardClick: embedded
                ? undefined
                : (task: TaskRecord) => {
                      void openTaskInspector(task)
                  },
            onAddTask: embedded
                ? undefined
                : (statusId: string) => {
                      void handleAddTask(statusId)
                  },
            columnBodyHeight: columnHeights[status.id],
            onColumnBodyHeightChange: (height: number) => {
                void handleColumnHeightChange(status.id, height)
            },
        }
    }

    async function handleColumnHeightChange(statusId: string, height: number) {
        columnHeights = {
            ...columnHeights,
            [statusId]: height,
        }

        nodes = nodes.map((node) =>
            node.id === statusId
                ? { ...node, data: { ...node.data, columnBodyHeight: height } }
                : node,
        )

        await saveColumnHeight(statusId, height)
    }

    async function syncFlowGraph() {
        const tasksByStatus = groupTasksByStatus(
            statuses,
            visibleTasks,
            columnSorts,
            columnFilters,
            effectiveGlobalFilters,
        )

        nodes = statuses.map((status) => ({
            id: status.id,
            type: 'kanbanColumn',
            position: { x: status.kanban_pos_x, y: status.kanban_pos_y },
            draggable: !embedded,
            dragHandle: '.kanban-column-drag-handle',
            selectable: false,
            focusable: false,
            data: buildNodeData(status, tasksByStatus.get(status.id) ?? []),
        }))

        await tick()
        edges = applyStatusFlowParallelOffsets(buildStatusFlowEdges(statusEdges, nodes), nodes)
    }

    function syncDragHighlights() {
        nodes = nodes.map((node) => ({
            ...node,
            data: {
                ...node.data,
                isDropTarget: node.id === hoverStatusId && draggingTaskId != null,
                draggingTaskId,
            },
        }))
    }

    async function loadBoard() {
        loading = true
        error = null

        try {
            const [{ statuses: loadedStatuses, edges: loadedEdges }, taskResult] =
                await Promise.all([loadTaskStatusMachine(), fetchTableRows('task')])

            statuses = loadedStatuses
            statusEdges = loadedEdges
            tasks = taskResult.rows.map(recordToTask)
            columnSorts = await loadAllColumnSortConfigs(loadedStatuses.map((status) => status.id))
            columnFilters = await loadAllColumnFilterConfigs(loadedStatuses.map((status) => status.id))
            columnHeights = await loadAllColumnHeights(loadedStatuses.map((status) => status.id))
            await refreshTaskContext()
            await syncFlowGraph()
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to load graph kanban'
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
        await syncFlowGraph()
    }

    async function handleFilterChange(statusId: string, filter: KanbanFilterRoot) {
        columnFilters = {
            ...columnFilters,
            [statusId]: filter,
        }
        await saveColumnFilterConfig(statusId, filter)
        await syncFlowGraph()
    }

    function handlePointerDragStart(event: PointerEvent, taskId: string) {
        setKanbanDragging(true)
        draggingTaskId = taskId
        dragPosition = { x: event.clientX, y: event.clientY }
        hoverStatusId = findStatusIdAtPoint(event.clientX, event.clientY)
        syncDragHighlights()

        document.body.style.userSelect = 'none'
        document.body.style.cursor = 'grabbing'

        function handlePointerMove(moveEvent: PointerEvent) {
            dragPosition = { x: moveEvent.clientX, y: moveEvent.clientY }
            const nextHover = findStatusIdAtPoint(moveEvent.clientX, moveEvent.clientY)
            if (nextHover !== hoverStatusId) {
                hoverStatusId = nextHover
                syncDragHighlights()
            }
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
            syncDragHighlights()

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
            await onTaskStatusChange?.(taskId, targetStatusId)
            await syncFlowGraph()
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
        await syncFlowGraph()
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
        await syncFlowGraph()
    }

    async function onNodeDragStop(event: { targetNode: Node | null }) {
        const dragged = event.targetNode
        if (!dragged) return

        try {
            await updateTaskStatusKanbanPosition(
                dragged.id,
                dragged.position.x,
                dragged.position.y,
            )
            statuses = statuses.map((status) =>
                status.id === dragged.id
                    ? {
                          ...status,
                          kanban_pos_x: dragged.position.x,
                          kanban_pos_y: dragged.position.y,
                      }
                    : status,
            )
            edges = applyStatusFlowParallelOffsets(edges, nodes)
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to save column position'
        }
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
            await syncFlowGraph()
            await openTaskInspector(newTask)
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to add task'
        } finally {
            actionLoading = false
        }
    }

    onMount(() => {
        void (async () => {
            if (globalFilters === undefined) {
                storedGlobalFilters = await loadKanbanGlobalFilters()
            }
            await loadBoard()
        })()
    })

    $effect(() => {
        effectiveGlobalFilters.ignoreTrophyTasks
        effectiveGlobalFilters.ignoreTasksWithChildren
        effectiveGlobalFilters.useGlobalColumnFilter
        effectiveGlobalFilters.useGlobalColumnSort
        effectiveGlobalFilters.globalColumnFilter
        effectiveGlobalFilters.globalColumnSort
        if (loading || statuses.length === 0) return
        void syncFlowGraph()
    })
</script>

<div class="graph-kanban flex h-full min-h-0 flex-col gap-3">
    {#if !embedded}
        <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="text-sm text-base-content/70">
                Drag column headers to reposition the graph layout. Drag tasks to any column.
            </p>
            <button class="btn btn-sm btn-ghost gap-2" disabled={loading} onclick={() => void loadBoard()}>
                <RefreshCw class="h-4 w-4" />
                Reload
            </button>
        </div>
    {/if}

    {#if error}
        <div class="alert alert-error py-2 text-sm">
            <span>{error}</span>
        </div>
    {/if}

    <div
            class="graph-kanban-flow relative min-h-0 flex-1 rounded-box border border-base-300 bg-base-100"
            class:border-0={embedded}
            class:rounded-none={embedded}
    >
        {#if loading}
            <div class="flex h-full min-h-[24rem] items-center justify-center" class:min-h-[16rem]={embedded}>
                <span class="loading loading-spinner loading-lg text-primary"></span>
            </div>
        {:else if statuses.length === 0}
            <div class="flex h-full min-h-[24rem] items-center justify-center p-4">
                <div class="alert alert-info max-w-xl">
                    <span>No task statuses configured. Add statuses on the Statuses page first.</span>
                </div>
            </div>
        {:else}
            <SvelteFlow
                    bind:nodes
                    bind:edges
                    {nodeTypes}
                    {edgeTypes}
                    defaultEdgeOptions={statusFlowDefaultEdgeOptions}
                    nodesDraggable={!embedded}
                    nodesConnectable={false}
                    elementsSelectable={false}
                    panOnDrag={[0, 1]}
                    fitView
                    minZoom={0.2}
                    maxZoom={1.5}
                    onnodedragstop={embedded ? undefined : onNodeDragStop}
            >
                {#if !embedded}
                    <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
                    <Controls />
                    <MiniMap nodeColor={() => 'oklch(var(--p))'} />
                    <Panel position="top-left">
                        <div class="badge badge-outline bg-base-100/90">
                            {statuses.length} columns · {visibleTasks.length} tasks · {edges.length} transitions
                        </div>
                    </Panel>
                {/if}
            </SvelteFlow>
        {/if}
    </div>
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

<style>
    .graph-kanban-flow :global(.svelte-flow) {
        --xy-edge-stroke: oklch(var(--bc) / 0.45);
        --xy-edge-stroke-selected: oklch(var(--p));
        --xy-connectionline-stroke: oklch(var(--bc) / 0.45);
        --xy-edge-label-background-color: oklch(var(--b1));
        --xy-edge-label-color: oklch(var(--bc));
        --xy-background-color: oklch(var(--b1));
        --xy-background-pattern-dots-color: oklch(var(--bc) / 0.2);

        --xy-attribution-background-color: color-mix(
            in oklch,
            oklch(var(--b2)) 88%,
            transparent
        );

        --xy-minimap-background-color: oklch(var(--b2));
        --xy-minimap-mask-background-color: color-mix(
            in oklch,
            oklch(var(--b1)) 40%,
            transparent
        );
        --xy-minimap-mask-stroke-color: oklch(var(--bc) / 0.25);
        --xy-minimap-node-background-color: oklch(var(--p));
        --xy-minimap-node-stroke-color: transparent;

        --xy-controls-button-background-color: oklch(var(--b2));
        --xy-controls-button-background-color-hover: oklch(var(--b3));
        --xy-controls-button-color: oklch(var(--bc));
        --xy-controls-button-color-hover: oklch(var(--bc));
        --xy-controls-button-border-color: oklch(var(--bc) / 0.15);
        --xy-controls-box-shadow: 0 1px 3px oklch(var(--bc) / 0.12);
    }

    .graph-kanban-flow :global(.svelte-flow__controls) {
        border: 1px solid oklch(var(--bc) / 0.12);
        border-radius: var(--rounded-box, 0.5rem);
        overflow: hidden;
    }

    .graph-kanban-flow :global(.svelte-flow__minimap) {
        border: 1px solid oklch(var(--bc) / 0.12);
        border-radius: var(--rounded-box, 0.5rem);
        overflow: hidden;
    }

    .graph-kanban-flow :global(.status-transition-edge) {
        pointer-events: none !important;
    }

    .graph-kanban-flow :global(.status-transition-edge .svelte-flow__edge-path) {
        pointer-events: none !important;
    }

    .graph-kanban-flow :global(.svelte-flow__edge-label) {
        color: oklch(var(--bc));
        background: oklch(var(--b1));
        border: 1px solid oklch(var(--bc) / 0.2);
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 11px;
        line-height: 1.2;
    }
</style>
