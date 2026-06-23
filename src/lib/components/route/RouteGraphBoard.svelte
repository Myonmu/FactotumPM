<script lang="ts">
    import { onMount, untrack } from 'svelte'
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
    import '$lib/styles/xyflow-theme.css'
    import { LayoutGrid, RefreshCw } from 'lucide-svelte'

    import ConnectionDragPreview from '$lib/components/ConnectionDragPreview.svelte'
    import RouteDependencyInspector from '$lib/components/route/RouteDependencyInspector.svelte'
    import RouteGraphInitialFit from '$lib/components/route/RouteGraphInitialFit.svelte'
    import RoutePackageNode from '$lib/components/route/RoutePackageNode.svelte'
    import RouteTaskNode from '$lib/components/route/RouteTaskNode.svelte'
    import TaskEditor from '$lib/components/TaskEditor.svelte'
    import {
        addTaskDependency,
        clearTaskRoutePositions,
        deleteTableRow,
        fetchTableRows,
        loadDomainOptions,
        loadTaskDependencyEdges,
        loadTaskOptions,
        loadTaskRecord,
        recordToTask,
        removeTaskDependency,
        saveTaskRecord,
        taskHasChildren,
        updateTaskRoutePosition,
        type DomainOption,
        type TaskDependencyEdge,
        type TaskRecord,
        type TaskRef,
    } from '$lib/db/dataView'
    import { readSqlBoolean } from '$lib/db/coerce'
    import {
        loadTaskStatusMachine,
        loadTaskStatusOptions,
        isTerminalStatus,
        type TaskStatusEdgeRecord,
        type TaskStatusRecord,
    } from '$lib/db/taskStatusMachine'
    import { closeInspector, openInspector, syncInspectedTask, updateInspectorProps } from '$lib/inspector.svelte'
    import { buildRouteGraphElements, type RouteNodeData } from '$lib/route/buildRouteGraph'
    import {
        buildUndirectedTaskAdjacency,
        collectConnectedTaskIds,
    } from '$lib/route/connectivity'
    import { layoutRouteGraph, isTaskRoutePositionManual, resizeRoutePackagesFromChildren } from '$lib/route/layoutRouteGraph'
    import {
        getRouteGraphNav,
        getRouteGraphView,
        pushRouteGraphView,
        resetRouteGraphNav,
    } from '$lib/route/routeGraphNav.svelte'
    import { isRouteGraphDragging, setRouteGraphDragging } from '$lib/route/routeGraphDrag.svelte'
    import { consumeRouteFocusRequest } from '$lib/trophy/routeFocusRequest.svelte'
    import {
        beginTaskInspectorSession,
        endTaskInspectorSession,
        navigateToRelatedTask,
    } from '$lib/taskInspectorNav.svelte'

    let {
        projectId = null,
    }: {
        projectId?: string | null
    } = $props()

    const nodeTypes = { routeTask: RouteTaskNode, routePackage: RoutePackageNode }

    let nodes = $state.raw<Node<RouteNodeData>[]>([])
    let edges = $state.raw<Edge[]>([])
    let tasks = $state<TaskRecord[]>([])
    let domains = $state<DomainOption[]>([])
    let taskOptions = $state<TaskRef[]>([])
    let statusOptions = $state<{ id: string; title: string; is_initial?: boolean }[]>([])
    let statuses = $state<TaskStatusRecord[]>([])
    let statusEdges = $state<TaskStatusEdgeRecord[]>([])
    let taskDependencies = $state<TaskDependencyEdge[]>([])
    let loading = $state(true)
    let error = $state<string | null>(null)
    let actionLoading = $state(false)
    let connectionDragSourceId = $state<string | null>(null)
    let connectionDragClient = $state<{ clientX: number; clientY: number } | null>(null)
    let connectionDropTargetId = $state<string | null>(null)

    let dragResizeFrame: number | null = null
    let pendingDragResize: { id: string; position: { x: number; y: number } } | null = null
    let showAutoLayoutConfirm = $state(false)
    let autoLayoutLoading = $state(false)
    let fitViewTrigger = $state(0)

    let connectionDrag = $derived(
        connectionDragSourceId && connectionDragClient
            ? {
                  sourceId: connectionDragSourceId,
                  clientX: connectionDragClient.clientX,
                  clientY: connectionDragClient.clientY,
              }
            : null,
    )

    const graphNav = $derived(getRouteGraphNav())
    const graphView = $derived(getRouteGraphView())
    const graphFocusKey = $derived(
        graphView.filterTaskIds == null
            ? 'all'
            : `${graphView.anchorTaskId ?? 'none'}:${[...graphView.filterTaskIds].sort().join(',')}`,
    )

    const terminalStatusIds = $derived(
        new Set(statuses.filter(isTerminalStatus).map((status) => status.id)),
    )

    async function refreshTaskContext() {
        const [loadedDomains, loadedTasks, loadedStatuses, machine, loadedDependencies] =
            await Promise.all([
                loadDomainOptions(projectId),
                loadTaskOptions(projectId),
                loadTaskStatusOptions(),
                loadTaskStatusMachine(projectId),
                loadTaskDependencyEdges(),
            ])

        domains = loadedDomains
        taskOptions = loadedTasks
        statusOptions = loadedStatuses
        statuses = machine.statuses
        statusEdges = machine.edges
        taskDependencies = loadedDependencies
    }

    function taskTitleById(taskId: string): string {
        return tasks.find((task) => task.id === taskId)?.title ?? taskId
    }

    function dependencyIdFromEdgeId(edgeId: string): string | null {
        if (!edgeId.startsWith('dependency:')) return null
        return edgeId.slice('dependency:'.length)
    }

    function syncConnectionHighlights() {
        nodes = nodes.map((node) => ({
            ...node,
            data: {
                ...node.data,
                isConnectionSource: node.id === connectionDragSourceId,
                isDropTarget:
                    node.id === connectionDropTargetId
                    && node.id !== connectionDragSourceId,
            },
        }))
    }

    function clearConnectionDrag() {
        connectionDragSourceId = null
        connectionDragClient = null
        connectionDropTargetId = null
        syncConnectionHighlights()
    }

    function handleConnectionDragStart(sourceId: string, event: PointerEvent) {
        connectionDragSourceId = sourceId
        connectionDragClient = {
            clientX: event.clientX,
            clientY: event.clientY,
        }
        connectionDropTargetId = null
        error = null
        syncConnectionHighlights()
    }

    function findNodeIdAtClientPoint(clientX: number, clientY: number): string | null {
        const element = document.elementFromPoint(clientX, clientY)?.closest('.svelte-flow__node')
        return element?.getAttribute('data-id') ?? null
    }

    function finishConnectionDrag(event?: PointerEvent) {
        const source = connectionDragSourceId
        let target = connectionDropTargetId

        if (!target && event) {
            target = findNodeIdAtClientPoint(event.clientX, event.clientY)
        }

        clearConnectionDrag()

        if (source && target && source !== target) {
            void createDependencyBetween(source, target)
        }
    }

    $effect(() => {
        if (!connectionDragSourceId) return

        function onPointerMove(event: PointerEvent) {
            if ((event.buttons & 2) === 0) return

            connectionDragClient = {
                clientX: event.clientX,
                clientY: event.clientY,
            }
        }

        function onPointerUp(event: PointerEvent) {
            if (event.button !== 2) return
            finishConnectionDrag(event)
        }

        function onContextMenu(event: MouseEvent) {
            event.preventDefault()
        }

        window.addEventListener('pointermove', onPointerMove)
        window.addEventListener('pointerup', onPointerUp)
        window.addEventListener('contextmenu', onContextMenu, true)

        return () => {
            window.removeEventListener('pointermove', onPointerMove)
            window.removeEventListener('pointerup', onPointerUp)
            window.removeEventListener('contextmenu', onContextMenu, true)
        }
    })

    function dependencyExists(fromTaskId: string, toTaskId: string): boolean {
        return taskDependencies.some(
            (dependency) =>
                dependency.from_task_id === fromTaskId
                && dependency.to_task_id === toTaskId,
        )
    }

    async function createDependencyBetween(fromTaskId: string, toTaskId: string) {
        if (fromTaskId === toTaskId) return

        if (dependencyExists(fromTaskId, toTaskId)) {
            error = 'This dependency already exists'
            return
        }

        actionLoading = true
        error = null

        try {
            await addTaskDependency(fromTaskId, toTaskId)
            await refreshTaskContext()
            rebuildGraph()
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to create dependency'
        } finally {
            actionLoading = false
        }
    }

    function onNodePointerEnter({ node }: { node: Node<RouteNodeData>; event: PointerEvent }) {
        if (!connectionDragSourceId || node.id === connectionDragSourceId) return
        connectionDropTargetId = node.id
        syncConnectionHighlights()
    }

    function onNodePointerLeave({ node }: { node: Node<RouteNodeData>; event: PointerEvent }) {
        if (connectionDropTargetId !== node.id) return
        connectionDropTargetId = null
        syncConnectionHighlights()
    }

    function onPaneContextMenu({ event }: { event: MouseEvent }) {
        event.preventDefault()
    }

    function openDependencyInspector(dependencyId: string) {
        const dependency = taskDependencies.find((entry) => entry.id === dependencyId)
        if (!dependency) return

        endTaskInspectorSession()

        openInspector(
            RouteDependencyInspector,
            {
                fromTaskTitle: taskTitleById(dependency.from_task_id),
                toTaskTitle: taskTitleById(dependency.to_task_id),
                onDelete: () => handleDeleteDependency(dependencyId),
            },
            'Dependency Inspector',
        )
    }

    async function handleDeleteDependency(dependencyId: string) {
        actionLoading = true
        error = null

        try {
            await removeTaskDependency(dependencyId)
            closeInspector()
            await refreshTaskContext()
            rebuildGraph()
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to delete dependency'
        } finally {
            actionLoading = false
        }
    }

    function onEdgeClick({ edge }: { edge: Edge; event: MouseEvent }) {
        const dependencyId = dependencyIdFromEdgeId(edge.id)
        if (!dependencyId) return
        openDependencyInspector(dependencyId)
    }

    function focusConnectedComponent(task: TaskRecord) {
        const adjacency = buildUndirectedTaskAdjacency(tasks, taskDependencies)
        const componentIds = collectConnectedTaskIds(task.id, adjacency)

        pushRouteGraphView({
            filterTaskIds: [...componentIds],
            anchorTaskId: task.id,
        })
    }

    async function persistRoutePositionUpdates(
        updates: Array<{ id: string; x: number; y: number }>,
    ) {
        const uniqueUpdates = new Map(updates.map((update) => [update.id, update]))

        for (const update of uniqueUpdates.values()) {
            await updateTaskRoutePosition(update.id, update.x, update.y)
        }

        if (uniqueUpdates.size === 0) return

        tasks = tasks.map((task) => {
            const update = uniqueUpdates.get(task.id)
            if (!update) return task

            return {
                ...task,
                route_pos_x: update.x,
                route_pos_y: update.y,
                route_pos_manual: true,
            }
        })

        nodes = nodes.map((node) => {
            const update = uniqueUpdates.get(node.id)
            if (!update) return node

            return {
                ...node,
                position: { x: update.x, y: update.y },
                data: {
                    ...node.data,
                    task: {
                        ...node.data.task,
                        route_pos_x: update.x,
                        route_pos_y: update.y,
                        route_pos_manual: true,
                    },
                },
            }
        })
    }

    async function onNodeDragStop(event: { targetNode: Node<RouteNodeData> | null }) {
        const dragged = event.targetNode
        if (!dragged) {
            setRouteGraphDragging(false)
            return
        }

        if (dragResizeFrame != null) {
            cancelAnimationFrame(dragResizeFrame)
            dragResizeFrame = null
        }
        pendingDragResize = null

        try {
            const resized = resizeRoutePackagesFromChildren(nodes, dragged.id, {
                interaction: 'settle',
                dragPosition: dragged.position,
            })
            nodes = resized.nodes

            const finalDragged = resized.nodes.find((node) => node.id === dragged.id)
            if (!finalDragged) return

            const updates = [...resized.positionUpdates]
            if (!updates.some((update) => update.id === finalDragged.id)) {
                updates.push({
                    id: finalDragged.id,
                    x: finalDragged.position.x,
                    y: finalDragged.position.y,
                })
            }

            await persistRoutePositionUpdates(updates)
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to save node position'
        } finally {
            setRouteGraphDragging(false)
        }
    }

    function onNodeDragStart(_event: { targetNode: Node<RouteNodeData> | null }) {
        setRouteGraphDragging(true)
    }

    function onNodeDrag(event: { targetNode: Node<RouteNodeData> | null }) {
        const dragged = event.targetNode
        if (!dragged?.parentId) return

        pendingDragResize = { id: dragged.id, position: dragged.position }

        if (dragResizeFrame != null) return

        dragResizeFrame = requestAnimationFrame(() => {
            dragResizeFrame = null
            const pending = pendingDragResize
            if (!pending) return

            nodes = resizeRoutePackagesFromChildren(nodes, pending.id, {
                interaction: 'drag',
                dragPosition: pending.position,
            }).nodes
        })
    }

    function rebuildGraph(options: { preserveManualPositions?: boolean } = {}) {
        if (isRouteGraphDragging()) return

        const preserveManualPositions = options.preserveManualPositions ?? true
        const previousById = new Map(nodes.map((node) => [node.id, node]))
        const visibleTaskIds = graphView.filterTaskIds
            ? new Set(graphView.filterTaskIds)
            : new Set(tasks.map((task) => task.id))

        const built = buildRouteGraphElements({
            tasks,
            dependencies: taskDependencies,
            domains,
            visibleTaskIds,
            terminalStatusIds,
            connectionDragSourceId,
            connectionDropTargetId,
            onCardClick: (clickedTask) => {
                void openTaskInspector(clickedTask)
            },
            onMiddleClick: (clickedTask) => {
                focusConnectedComponent(clickedTask)
            },
            onConnectionDragStart: handleConnectionDragStart,
        })

        const laidOut = layoutRouteGraph(built.nodes, built.edges)

        if (!preserveManualPositions) {
            nodes = laidOut
            edges = built.edges
            return
        }

        nodes = laidOut.map((node) => {
            const task = node.data?.task
            if (!isTaskRoutePositionManual(task)) return node

            const previous = previousById.get(node.id)
            const position =
                previous?.position
                ?? (task.route_pos_x != null && task.route_pos_y != null
                    ? { x: task.route_pos_x, y: task.route_pos_y }
                    : node.position)

            return {
                ...node,
                position: { ...position },
                width: previous?.width ?? node.width,
                height: previous?.height ?? node.height,
                style: previous?.style ?? node.style,
                data: {
                    ...node.data,
                    task: {
                        ...task,
                        route_pos_x: position.x,
                        route_pos_y: position.y,
                        route_pos_manual: true,
                    },
                },
            }
        })
        edges = built.edges
    }

    async function confirmAutoLayout() {
        autoLayoutLoading = true
        error = null

        try {
            const taskIds = tasks.map((task) => task.id)
            await clearTaskRoutePositions(taskIds)
            tasks = tasks.map((task) => ({
                ...task,
                route_pos_x: null,
                route_pos_y: null,
                route_pos_manual: false,
            }))
            rebuildGraph({ preserveManualPositions: false })
            fitViewTrigger += 1
            showAutoLayoutConfirm = false
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to apply auto layout'
        } finally {
            autoLayoutLoading = false
        }
    }

    async function loadGraph() {
        loading = true
        error = null

        try {
            const taskResult = await fetchTableRows('task', projectId)
            tasks = taskResult.rows.map(recordToTask)
            await refreshTaskContext()
            rebuildGraph()

            // Honor a focus request handed over from another tab (e.g. the Trophy
            // tab). Pushing the view keeps the full graph in the back stack so the
            // Focus "Back" button returns to it.
            const focusRequest = consumeRouteFocusRequest()
            if (focusRequest) {
                pushRouteGraphView(focusRequest)
            }
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to load route graph'
        } finally {
            loading = false
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
            const liveNode = nodes.find((node) => node.id === task.id)
            const storedTask =
                tasks.find((entry) => entry.id === task.id)
                ?? task
            const liveTask: TaskRecord = liveNode
                ? {
                      ...storedTask,
                      ...liveNode.data.task,
                      route_pos_x: liveNode.position.x,
                      route_pos_y: liveNode.position.y,
                      route_pos_manual: liveNode.data.task.route_pos_manual ?? storedTask.route_pos_manual,
                  }
                : storedTask

            const hasChildren = await taskHasChildren(liveTask.id)
            await refreshTaskContext()

            beginTaskInspectorSession(inspectTaskById)

            openInspector(
                TaskEditor,
                {
                    task: liveTask,
                    domains,
                    tasks: taskOptions,
                    statuses: statusOptions,
                    statusEdges,
                    taskDependencies,
                    hasChildren,
                    onSave: handleTaskSave,
                    onDelete: handleTaskDelete,
                    onChildrenChange: () => handleChildrenChange(liveTask.id),
                    onDependenciesChange: () => handleDependenciesChange(liveTask.id),
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

        const existing = tasks.find((task) => task.id === updatedTask.id)
        const liveNode = nodes.find((node) => node.id === updatedTask.id)
        const preserveRouteLayout =
            readSqlBoolean(existing?.route_pos_manual)
            || readSqlBoolean(liveNode?.data.task.route_pos_manual)

        const merged: TaskRecord = existing
            ? {
                  ...existing,
                  ...updatedTask,
                  route_pos_x: preserveRouteLayout && liveNode
                      ? liveNode.position.x
                      : existing.route_pos_x,
                  route_pos_y: preserveRouteLayout && liveNode
                      ? liveNode.position.y
                      : existing.route_pos_y,
                  route_pos_manual: preserveRouteLayout
                      ? true
                      : existing.route_pos_manual,
              }
            : updatedTask

        tasks = tasks.map((task) => (task.id === merged.id ? merged : task))
        await refreshTaskContext()
        updateInspectorProps({ statusEdges, taskDependencies })
        rebuildGraph()
    }

    async function handleChildrenChange(taskId: string) {
        const childCount = await taskHasChildren(taskId)
        await refreshTaskContext()
        updateInspectorProps({ hasChildren: childCount, tasks: taskOptions })
        rebuildGraph()
    }

    async function handleDependenciesChange(_taskId: string) {
        await refreshTaskContext()
        updateInspectorProps({ taskDependencies, tasks: taskOptions })
        rebuildGraph()
    }

    async function handleTaskDelete(taskId: string) {
        await deleteTableRow('task', taskId)
        tasks = tasks.filter((task) => task.id !== taskId)
        closeInspector()
        await refreshTaskContext()
        rebuildGraph()
    }

    $effect(() => {
        if (loading) return

        graphView.filterTaskIds
        graphView.anchorTaskId
        untrack(() => rebuildGraph())
    })

    let initialized = false

    onMount(() => {
        resetRouteGraphNav()
        void loadGraph().then(() => { initialized = true })

        return () => {
            resetRouteGraphNav()
        }
    })

    $effect(() => {
        const _pid = projectId
        if (initialized) {
            resetRouteGraphNav()
            void loadGraph()
        }
    })
</script>

<div class="route-graph flex h-full min-h-0 flex-col gap-3">
    <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-base-content/70">
            Task hierarchy and dependencies. Drag nodes to reposition. Click a card to inspect.
            Right-drag between tasks to add a dependency. Click a link to inspect or delete it.
            Middle-click to focus the connected subgraph.
        </p>
        {#if connectionDragSourceId}
            <p class="text-xs text-accent">Release on the prerequisite task…</p>
        {/if}
        <div class="flex flex-wrap items-center gap-2">
            <button
                    class="btn btn-sm btn-outline gap-2"
                    disabled={loading || autoLayoutLoading || actionLoading || isRouteGraphDragging()}
                    onclick={() => (showAutoLayoutConfirm = true)}
            >
                <LayoutGrid class="h-4 w-4" />
                Auto layout
            </button>
            <button class="btn btn-sm btn-ghost gap-2" disabled={loading} onclick={() => void loadGraph()}>
                <RefreshCw class="h-4 w-4" />
                Reload
            </button>
        </div>
    </div>

    {#if error}
        <div class="alert alert-error py-2 text-sm">
            <span>{error}</span>
        </div>
    {/if}

    <div class="route-graph-flow relative min-h-0 flex-1 rounded-box border border-base-300 bg-base-100">
        {#if loading}
            <div class="flex h-full min-h-[24rem] items-center justify-center">
                <span class="loading loading-spinner loading-lg text-primary"></span>
            </div>
        {:else if tasks.length === 0}
            <div class="flex h-full min-h-[24rem] items-center justify-center p-4">
                <div class="alert alert-info max-w-xl">
                    <span>No tasks yet. Add tasks in Data View or Kanban first.</span>
                </div>
            </div>
        {:else}
            {#key graphFocusKey}
                <SvelteFlow
                        bind:nodes
                        bind:edges
                        {nodeTypes}
                        nodeOrigin={[0, 0]}
                        nodesDraggable={true}
                        nodesConnectable={false}
                        elementsSelectable={false}
                        panOnDrag={[0, 1]}
                        zoomOnScroll={true}
                        minZoom={0.15}
                        maxZoom={1.5}
                        onnodedragstart={onNodeDragStart}
                        onnodedrag={onNodeDrag}
                        onnodedragstop={onNodeDragStop}
                        onnodepointerenter={onNodePointerEnter}
                        onnodepointerleave={onNodePointerLeave}
                        onpanecontextmenu={onPaneContextMenu}
                        onedgeclick={onEdgeClick}
                >
                    <RouteGraphInitialFit trigger={fitViewTrigger} />
                    <ConnectionDragPreview drag={connectionDrag} />
                    <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
                    <Controls />
                    <MiniMap nodeColor={() => 'oklch(var(--p))'} />
                    <Panel position="top-left">
                    <div class="flex flex-col gap-2">
                        <div class="badge badge-outline bg-base-100/90">
                            {nodes.length} tasks · {edges.length} links
                        </div>
                        {#if graphNav.isFiltered}
                            <div class="badge badge-primary bg-base-100/90">
                                Focused subgraph
                                {#if graphNav.anchorTaskId}
                                    · anchor {tasks.find((task) => task.id === graphNav.anchorTaskId)?.title
                                        ?? graphNav.anchorTaskId}
                                {/if}
                            </div>
                        {/if}
                        <div class="rounded-box border border-base-300 bg-base-100/95 p-2 text-xs text-base-content/70">
                            <div class="flex items-center gap-2">
                                <span class="inline-block h-3 w-5 rounded-sm border-2 border-dashed border-base-content/45"></span>
                                Package contains subtasks
                            </div>
                            <div class="mt-1 flex items-center gap-2">
                                <span class="inline-block h-0.5 w-6 bg-primary"></span>
                                Depends on
                            </div>
                        </div>
                    </div>
                </Panel>
                </SvelteFlow>
            {/key}
        {/if}
    </div>
</div>

{#if showAutoLayoutConfirm}
    <dialog class="modal modal-open">
        <div class="modal-box">
            <h3 class="text-lg font-bold">Apply auto layout?</h3>
            <p class="py-4 text-base-content/70">
                This will clear all manual node positions and automatically arrange every task
                in the project. Dragged layouts cannot be undone except by repositioning tasks
                manually.
            </p>
            <div class="modal-action">
                <button
                        type="button"
                        class="btn btn-ghost"
                        disabled={autoLayoutLoading}
                        onclick={() => (showAutoLayoutConfirm = false)}
                >
                    Cancel
                </button>
                <button
                        type="button"
                        class="btn btn-primary"
                        disabled={autoLayoutLoading}
                        onclick={() => void confirmAutoLayout()}
                >
                    {#if autoLayoutLoading}
                        <span class="loading loading-spinner loading-sm"></span>
                    {/if}
                    Apply layout
                </button>
            </div>
        </div>
        <form method="dialog" class="modal-backdrop">
            <button
                    type="button"
                    disabled={autoLayoutLoading}
                    onclick={() => (showAutoLayoutConfirm = false)}
            >
                close
            </button>
        </form>
    </dialog>
{/if}

<style>
    .route-graph-flow {
        height: 100%;
        min-height: 24rem;
    }

    .route-graph-flow :global(.svelte-flow) {
        width: 100%;
        height: 100%;
        min-height: 24rem;
    }

    .route-graph-flow :global(.svelte-flow__pane) {
        cursor: grab;
    }

    .route-graph-flow :global(.svelte-flow__pane:active) {
        cursor: grabbing;
    }

    .route-graph-flow :global(.route-task-node) {
        pointer-events: all;
    }

    .route-graph-flow :global(.svelte-flow__node.route-package-group),
    .route-graph-flow :global(.svelte-flow__node.parent:has(.route-package-node)) {
        overflow: visible;
    }

    .route-graph-flow :global(.route-dependency-edge) {
        pointer-events: none !important;
    }

    .route-graph-flow :global(.route-dependency-edge .svelte-flow__edge-path) {
        pointer-events: none !important;
    }

    .route-graph-flow :global(.route-dependency-edge .svelte-flow__edge-interaction) {
        pointer-events: stroke !important;
        cursor: pointer;
    }
</style>
