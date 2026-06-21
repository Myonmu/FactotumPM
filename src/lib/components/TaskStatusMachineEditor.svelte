<script lang="ts">
    import { onMount } from 'svelte'
    import {
        Background,
        BackgroundVariant,
        Controls,
        MarkerType,
        MiniMap,
        Panel,
        SvelteFlow,
        type Edge,
        type Node,
    } from '@xyflow/svelte'
    import '@xyflow/svelte/dist/style.css'
    import { Flag, Plus, RefreshCw, Trash2, CircleStop } from 'lucide-svelte'

    import StatusNode from '$lib/components/StatusNode.svelte'
    import StatusTransitionEdge from '$lib/components/StatusTransitionEdge.svelte'
    import ConnectionDragPreview from '$lib/components/ConnectionDragPreview.svelte'
    import {
        computeParallelOffsets,
        getConnectionHandleIds,
        getNodeBoxFromFlowNode,
        parallelOffsetForNewEdge,
    } from '$lib/stateMachine/geometry'
    import { colorIntToHex } from '$lib/grid/colorUtils'
    import OptionalColorInput from '$lib/components/OptionalColorInput.svelte'
    import {
        DEFAULT_STATUS_EDGE_COLOR_HEX,
        getStatusEdgeColorHex,
    } from '$lib/statusMachine/edgeColor'
    import {
        createTaskStatus,
        createTaskStatusEdge,
        deleteTaskStatus,
        deleteTaskStatusEdge,
        loadTaskStatusMachine,
        setInitialTaskStatus,
        updateTaskStatus,
        updateTaskStatusEdge,
        type TaskStatusEdgeRecord,
        type TaskStatusRecord,
    } from '$lib/db/taskStatusMachine'

    const nodeTypes = { status: StatusNode }
    const edgeTypes = { statusTransition: StatusTransitionEdge }

    const EDGE_LABEL_STYLE =
        'color: oklch(var(--bc)); background: oklch(var(--b1)); font-size: 11px; padding: 2px 6px; border-radius: 4px; border: 1px solid oklch(var(--bc) / 0.2);'

    const DEFAULT_COLOR_PICKER = DEFAULT_STATUS_EDGE_COLOR_HEX

    const defaultEdgeOptions = {
        type: 'statusTransition' as const,
        markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20 },
        labelStyle: EDGE_LABEL_STYLE,
    }

    let nodes = $state.raw<Node[]>([])
    let edges = $state.raw<Edge[]>([])
    let loading = $state(true)
    let error = $state<string | null>(null)
    let actionLoading = $state(false)
    let selectedNodeId = $state<string | null>(null)
    let selectedEdgeId = $state<string | null>(null)
    let connectionDragSourceId = $state<string | null>(null)
    let connectionDragClient = $state<{ clientX: number; clientY: number } | null>(null)
    let connectionDropTargetId = $state<string | null>(null)

    let connectionDrag = $derived(
        connectionDragSourceId && connectionDragClient
            ? {
                  sourceId: connectionDragSourceId,
                  clientX: connectionDragClient.clientX,
                  clientY: connectionDragClient.clientY,
              }
            : null,
    )

    let selectedStatus = $derived.by(() => {
        if (!selectedNodeId) return null
        const node = nodes.find((entry) => entry.id === selectedNodeId)
        if (!node) return null
        return {
            id: node.id,
            name: String(node.data?.label ?? ''),
            description: (node.data?.description as string | null | undefined) ?? null,
            isInitial: Boolean(node.data?.isInitial),
            isTerminal: Boolean(node.data?.isTerminal),
            color: (node.data?.color as number | null | undefined) ?? null,
            colorHex: colorIntToHex(node.data?.color) ?? DEFAULT_COLOR_PICKER,
        }
    })

    function nodeLabelById(nodeId: string): string {
        const node = nodes.find((entry) => entry.id === nodeId)
        const label = node?.data?.label
        return label ? String(label) : nodeId
    }

    let selectedEdge = $derived.by(() => {
        if (!selectedEdgeId) return null
        const edge = edges.find((entry) => entry.id === selectedEdgeId)
        if (!edge) return null
        const targetNode = nodes.find((entry) => entry.id === edge.target)
        const targetColor = (targetNode?.data?.color as number | null | undefined) ?? null

        return {
            id: edge.id,
            action: edge.label == null ? '' : String(edge.label),
            sourceName: nodeLabelById(edge.source),
            targetName: nodeLabelById(edge.target),
            color: (edge.data?.color as number | null | undefined) ?? null,
            colorHex: getStatusEdgeColorHex(edge.data?.color, targetColor),
        }
    })

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
        const element = document.elementFromPoint(clientX, clientY)?.closest(
            '.svelte-flow__node',
        )

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
            void createEdgeBetween(source, target)
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

    function statusToNode(status: TaskStatusRecord): Node {
        return {
            id: status.id,
            type: 'status',
            position: { x: status.pos_x, y: status.pos_y },
            data: {
                label: status.name,
                description: status.description,
                color: status.color,
                isInitial: status.is_initial === 1,
                isTerminal: status.is_terminal === 1,
                isConnectionSource: status.id === connectionDragSourceId,
                isDropTarget:
                    status.id === connectionDropTargetId
                    && status.id !== connectionDragSourceId,
                onRename: handleRenameStatus,
                onConnectionDragStart: handleConnectionDragStart,
            },
        }
    }

    function edgeEndpointsFromEdges(edgeList: Edge[]) {
        return edgeList.map((edge) => ({
            id: edge.id,
            from_status_id: edge.source,
            to_status_id: edge.target,
        }))
    }

    function resolveEdgeHandles(sourceId: string, targetId: string) {
        const sourceNode = nodes.find((node) => node.id === sourceId)
        const targetNode = nodes.find((node) => node.id === targetId)

        if (!sourceNode || !targetNode) {
            return {
                sourceHandle: 'connect-source-top',
                targetHandle: 'connect-target-top',
            }
        }

        return getConnectionHandleIds(
            getNodeBoxFromFlowNode(sourceNode),
            getNodeBoxFromFlowNode(targetNode),
            sourceId,
            targetId,
        )
    }

    function edgeToFlowEdge(
        edge: TaskStatusEdgeRecord,
        parallelOffset = 0,
    ): Edge {
        const handles = resolveEdgeHandles(
            edge.from_status_id,
            edge.to_status_id,
        )

        return {
            id: edge.id,
            source: edge.from_status_id,
            target: edge.to_status_id,
            sourceHandle: handles.sourceHandle,
            targetHandle: handles.targetHandle,
            label: edge.action ?? undefined,
            labelStyle: EDGE_LABEL_STYLE,
            type: 'statusTransition',
            class: 'status-transition-edge',
            markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20 },
            interactionWidth: 24,
            data: {
                parallelOffset,
                color: edge.color ?? undefined,
            },
        }
    }

    function refreshEdgeHandles(edgeList: Edge[]): Edge[] {
        return edgeList.map((edge) => {
            const parallelOffset = edge.data?.parallelOffset ?? 0
            const handles = resolveEdgeHandles(
                edge.source,
                edge.target,
            )

            return {
                ...edge,
                sourceHandle: handles.sourceHandle,
                targetHandle: handles.targetHandle,
            }
        })
    }

    function applyParallelOffsets(edgeList: Edge[]): Edge[] {
        const offsets = computeParallelOffsets(edgeEndpointsFromEdges(edgeList))

        return refreshEdgeHandles(
            edgeList.map((edge) => ({
                ...edge,
                type: 'statusTransition',
                class: edge.class ?? 'status-transition-edge',
                interactionWidth: edge.interactionWidth ?? 24,
                data: {
                    ...(edge.data ?? {}),
                    parallelOffset: offsets.get(edge.id) ?? 0,
                },
            })),
        )
    }

    function connectionExists(source: string, target: string): boolean {
        return edges.some((edge) => edge.source === source && edge.target === target)
    }

    async function createEdgeBetween(source: string, target: string) {
        if (source === target) return

        if (connectionExists(source, target)) {
            error = 'This transition already exists'
            return
        }

        const parallelOffset = parallelOffsetForNewEdge(
            source,
            target,
            edgeEndpointsFromEdges(edges),
        )
        const pendingId = `pending-${source}-${target}`

        edges = applyParallelOffsets([
            ...edges,
            edgeToFlowEdge(
                {
                    id: pendingId,
                    from_status_id: source,
                    to_status_id: target,
                    action: null,
                    color: null,
                },
                parallelOffset,
            ),
        ])

        actionLoading = true
        error = null

        try {
            const created = await createTaskStatusEdge({
                from_status_id: source,
                to_status_id: target,
            })
            edges = applyParallelOffsets(
                edges.map((edge) =>
                    edge.id === pendingId ? edgeToFlowEdge(created) : edge,
                ),
            )
        } catch (err) {
            edges = applyParallelOffsets(edges.filter((edge) => edge.id !== pendingId))
            error = err instanceof Error ? err.message : 'Failed to create transition'
        } finally {
            actionLoading = false
        }
    }

    function onNodePointerEnter({
        node,
    }: {
        node: Node
        event: PointerEvent
    }) {
        if (!connectionDragSourceId || node.id === connectionDragSourceId) return
        connectionDropTargetId = node.id
        syncConnectionHighlights()
    }

    function onNodePointerLeave({
        node,
    }: {
        node: Node
        event: PointerEvent
    }) {
        if (connectionDropTargetId !== node.id) return
        connectionDropTargetId = null
        syncConnectionHighlights()
    }

    function onPaneContextMenu({ event }: { event: MouseEvent }) {
        event.preventDefault()
    }

    function syncNodesFromStatuses(statuses: TaskStatusRecord[]) {
        nodes = statuses.map(statusToNode)
    }

    function syncEdgesFromRecords(records: TaskStatusEdgeRecord[]) {
        const offsets = computeParallelOffsets(
            records.map((edge) => ({
                id: edge.id,
                from_status_id: edge.from_status_id,
                to_status_id: edge.to_status_id,
            })),
        )

        edges = records.map((edge) =>
            edgeToFlowEdge(edge, offsets.get(edge.id) ?? 0),
        )
    }

    async function reload() {
        loading = true
        error = null

        try {
            const machine = await loadTaskStatusMachine()
            syncNodesFromStatuses(machine.statuses)
            syncEdgesFromRecords(machine.edges)
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to load status machine'
        } finally {
            loading = false
        }
    }

    async function handleRenameStatus(id: string, name: string) {
        await updateTaskStatus(id, { name })
        nodes = nodes.map((node) =>
            node.id === id
                ? { ...node, data: { ...node.data, label: name } }
                : node,
        )
    }

    async function handleAddStatus() {
        actionLoading = true
        error = null

        try {
            const offset = nodes.length * 40
            const created = await createTaskStatus({
                name: `Status ${nodes.length + 1}`,
                pos_x: 120 + offset,
                pos_y: 160 + offset,
            })
            nodes = [...nodes, statusToNode(created)]
            selectedNodeId = created.id
            selectedEdgeId = null
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to add status'
        } finally {
            actionLoading = false
        }
    }

    async function handleDeleteSelected() {
        if (selectedNodeId) {
            actionLoading = true
            error = null
            try {
                await deleteTaskStatus(selectedNodeId)
                nodes = nodes.filter((node) => node.id !== selectedNodeId)
                edges = applyParallelOffsets(
                    edges.filter(
                        (edge) =>
                            edge.source !== selectedNodeId
                            && edge.target !== selectedNodeId,
                    ),
                )
                if (connectionDragSourceId === selectedNodeId) {
                    clearConnectionDrag()
                }
                syncConnectionHighlights()
                selectedNodeId = null
            } catch (err) {
                error = err instanceof Error ? err.message : 'Failed to delete status'
            } finally {
                actionLoading = false
            }
            return
        }

        if (selectedEdgeId) {
            actionLoading = true
            error = null
            try {
                await deleteTaskStatusEdge(selectedEdgeId)
                edges = applyParallelOffsets(
                    edges.filter((edge) => edge.id !== selectedEdgeId),
                )
                selectedEdgeId = null
            } catch (err) {
                error = err instanceof Error ? err.message : 'Failed to delete transition'
            } finally {
                actionLoading = false
            }
        }
    }

    async function handleSetInitial() {
        if (!selectedNodeId) return

        actionLoading = true
        error = null
        try {
            await setInitialTaskStatus(selectedNodeId)
            nodes = nodes.map((node) => ({
                ...node,
                data: {
                    ...node.data,
                    isInitial: node.id === selectedNodeId,
                },
            }))
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to set initial status'
        } finally {
            actionLoading = false
        }
    }

    async function handleTerminalToggle(isTerminal: boolean) {
        if (!selectedNodeId) return

        const is_terminal = isTerminal ? 1 : 0
        actionLoading = true
        error = null

        try {
            await updateTaskStatus(selectedNodeId, { is_terminal })
            nodes = nodes.map((node) =>
                node.id === selectedNodeId
                    ? { ...node, data: { ...node.data, isTerminal } }
                    : node,
            )
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to update terminal status'
        } finally {
            actionLoading = false
        }
    }

    async function handleStatusFieldSave(
        field: 'name' | 'description',
        value: string,
    ) {
        if (!selectedNodeId) return

        const patch =
            field === 'name'
                ? { name: value.trim() || 'Untitled' }
                : { description: value.trim() || null }

        await updateTaskStatus(selectedNodeId, patch)
        nodes = nodes.map((node) =>
            node.id === selectedNodeId
                ? {
                      ...node,
                      data: {
                          ...node.data,
                          label: patch.name ?? node.data?.label,
                          description:
                              patch.description !== undefined
                                  ? patch.description
                                  : node.data?.description,
                      },
                  }
                : node,
        )
    }

    async function handleStatusColorSave(color: number) {
        if (!selectedNodeId) return

        await updateTaskStatus(selectedNodeId, { color })
        nodes = nodes.map((node) =>
            node.id === selectedNodeId
                ? { ...node, data: { ...node.data, color } }
                : node,
        )
    }

    async function handleStatusColorClear() {
        if (!selectedNodeId) return

        await updateTaskStatus(selectedNodeId, { color: null })
        nodes = nodes.map((node) =>
            node.id === selectedNodeId
                ? { ...node, data: { ...node.data, color: null } }
                : node,
        )
    }

    async function handleEdgeActionSave(action: string) {
        if (!selectedEdgeId) return
        const trimmed = action.trim()
        await updateTaskStatusEdge(selectedEdgeId, { action: trimmed || null })
        edges = edges.map((edge) =>
            edge.id === selectedEdgeId
                ? { ...edge, label: trimmed || undefined, labelStyle: EDGE_LABEL_STYLE }
                : edge,
        )
    }

    async function handleEdgeColorSave(color: number) {
        if (!selectedEdgeId) return

        await updateTaskStatusEdge(selectedEdgeId, { color })
        edges = edges.map((edge) =>
            edge.id === selectedEdgeId
                ? { ...edge, data: { ...(edge.data ?? {}), color } }
                : edge,
        )
    }

    async function handleEdgeColorClear() {
        if (!selectedEdgeId) return

        await updateTaskStatusEdge(selectedEdgeId, { color: null })
        edges = edges.map((edge) =>
            edge.id === selectedEdgeId
                ? { ...edge, data: { ...(edge.data ?? {}), color: null } }
                : edge,
        )
    }

    async function onNodeDragStop(event: {
        targetNode: Node | null
        nodes: Node[]
    }) {
        const dragged = event.targetNode
        if (!dragged) return

        await updateTaskStatus(dragged.id, {
            pos_x: dragged.position.x,
            pos_y: dragged.position.y,
        })
        edges = refreshEdgeHandles(edges)
    }

    async function onDelete({
        nodes: deletedNodes,
        edges: deletedEdges,
    }: {
        nodes: Node[]
        edges: Edge[]
    }) {
        actionLoading = true
        error = null
        try {
            await Promise.all([
                ...deletedNodes.map((node) => deleteTaskStatus(node.id)),
                ...deletedEdges
                    .filter((edge) => !edge.id.startsWith('pending-'))
                    .map((edge) => deleteTaskStatusEdge(edge.id)),
            ])
            if (deletedNodes.some((node) => node.id === selectedNodeId)) {
                selectedNodeId = null
            }
            if (deletedNodes.some((node) => node.id === connectionDragSourceId)) {
                clearConnectionDrag()
            }
            if (deletedEdges.some((edge) => edge.id === selectedEdgeId)) {
                selectedEdgeId = null
            }

            edges = applyParallelOffsets(edges)
            syncConnectionHighlights()
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to delete selection'
            await reload()
        } finally {
            actionLoading = false
        }
    }

    function onSelectionChange({
        nodes: selectedNodes,
        edges: selectedEdges,
    }: {
        nodes: Node[]
        edges: Edge[]
    }) {
        selectedNodeId = selectedNodes[0]?.id ?? null
        selectedEdgeId = selectedEdges[0]?.id ?? null
    }

    onMount(() => {
        void reload()
    })
</script>

<div class="flex h-full min-h-0 flex-col gap-3 p-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
            <h1 class="text-2xl font-bold">Task Status Machine</h1>
            <p class="text-sm text-base-content/70">
                Right-drag from a source status and drop on a target to add a directed transition.
            </p>
            {#if connectionDragSourceId}
                <p class="text-xs text-accent mt-1">Release on target status…</p>
            {/if}
        </div>

        <div class="flex flex-wrap gap-2">
            <button class="btn btn-sm btn-primary" disabled={actionLoading} onclick={handleAddStatus}>
                <Plus class="w-4 h-4" />
                Add status
            </button>
            <button
                class="btn btn-sm btn-outline"
                disabled={actionLoading || !selectedNodeId}
                onclick={handleSetInitial}
            >
                <Flag class="w-4 h-4" />
                Set initial
            </button>
            <button
                class="btn btn-sm btn-error btn-outline"
                disabled={actionLoading || (!selectedNodeId && !selectedEdgeId)}
                onclick={handleDeleteSelected}
            >
                <Trash2 class="w-4 h-4" />
                Delete selected
            </button>
            <button class="btn btn-sm btn-ghost" disabled={loading} onclick={reload}>
                <RefreshCw class="w-4 h-4" />
                Reload
            </button>
        </div>
    </div>

    {#if error}
        <div class="alert alert-error py-2 text-sm">
            <span>{error}</span>
        </div>
    {/if}

    <div class="flex min-h-0 flex-1 gap-3">
        <div class="status-machine-flow relative min-w-0 flex-1 rounded-box border border-base-300 bg-base-100">
            {#if loading}
                <div class="flex h-full items-center justify-center">
                    <span class="loading loading-spinner loading-lg"></span>
                </div>
            {:else}
                <SvelteFlow
                    bind:nodes
                    bind:edges
                    {nodeTypes}
                    {edgeTypes}
                    {defaultEdgeOptions}
                    nodesConnectable={false}
                    panOnDrag={[0]}
                    fitView
                    deleteKey={['Backspace', 'Delete']}
                    onnodepointerenter={onNodePointerEnter}
                    onnodepointerleave={onNodePointerLeave}
                    onpanecontextmenu={onPaneContextMenu}
                    onnodedragstop={onNodeDragStop}
                    ondelete={onDelete}
                    onselectionchange={onSelectionChange}
                >
                    <ConnectionDragPreview drag={connectionDrag} />
                    <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
                    <Controls />
                    <MiniMap
                        nodeColor={(node) =>
                            colorIntToHex(node.data?.color) ?? 'oklch(var(--p))'}
                    />
                    <Panel position="top-left">
                        <div class="badge badge-outline bg-base-100/90">
                            {nodes.length} statuses · {edges.length} transitions
                        </div>
                    </Panel>
                </SvelteFlow>
            {/if}
        </div>

        <aside class="w-72 shrink-0 rounded-box border border-base-300 bg-base-100 p-4">
            <h2 class="font-semibold mb-3">Inspector</h2>

            {#if selectedStatus}
                <div class="space-y-3">
                    <label class="form-control w-full">
                        <span class="label-text">Name</span>
                        <input
                            class="input input-bordered input-sm w-full"
                            value={selectedStatus.name}
                            onchange={(event) =>
                                handleStatusFieldSave('name', event.currentTarget.value)}
                        />
                    </label>

                    <label class="form-control w-full">
                        <span class="label-text">Description</span>
                        <textarea
                            class="textarea textarea-bordered textarea-sm w-full"
                            value={selectedStatus.description ?? ''}
                            onchange={(event) =>
                                handleStatusFieldSave('description', event.currentTarget.value)}
                        ></textarea>
                    </label>

                    <label class="form-control w-full">
                        <span class="label-text">Color (optional)</span>
                        <OptionalColorInput
                                value={selectedStatus.color}
                                emptyLabel="Default theme"
                                onChange={handleStatusColorSave}
                                onClear={handleStatusColorClear}
                        />
                    </label>

                    <label class="label cursor-pointer justify-start gap-3 py-1">
                        <input
                            type="checkbox"
                            class="checkbox checkbox-sm"
                            checked={selectedStatus.isTerminal}
                            disabled={actionLoading}
                            onchange={(event) =>
                                handleTerminalToggle(event.currentTarget.checked)}
                        />
                        <span class="label-text">Terminal status</span>
                    </label>

                    {#if selectedStatus.isTerminal}
                        <div class="badge badge-neutral gap-1">
                            <CircleStop class="w-3 h-3" />
                            Terminal — tasks here appear dimmed on the board
                        </div>
                    {/if}

                    {#if selectedStatus.isInitial}
                        <div class="badge badge-warning gap-1">
                            <Flag class="w-3 h-3" />
                            Initial status for new tasks
                        </div>
                    {/if}
                </div>
            {:else if selectedEdge}
                <div class="space-y-3">
                    <p class="text-sm text-base-content/70">
                        Transition from <span class="font-medium">{selectedEdge.sourceName}</span>
                        to <span class="font-medium">{selectedEdge.targetName}</span>
                    </p>
                    <label class="form-control w-full">
                        <span class="label-text">Action (optional)</span>
                        <input
                            class="input input-bordered input-sm w-full"
                            value={selectedEdge.action}
                            placeholder="e.g. start, complete"
                            onchange={(event) => handleEdgeActionSave(event.currentTarget.value)}
                        />
                    </label>

                    <label class="form-control w-full">
                        <span class="label-text">Color (optional)</span>
                        <OptionalColorInput
                                value={selectedEdge.color}
                                emptyLabel="Default theme"
                                onChange={handleEdgeColorSave}
                                onClear={handleEdgeColorClear}
                        />
                    </label>
                </div>
            {:else}
                <p class="text-sm text-base-content/60">
                    Select a status node or transition edge to edit details.
                </p>
            {/if}
        </aside>
    </div>
</div>

<style>
    .status-machine-flow :global(.svelte-flow) {
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

    .status-machine-flow :global(.svelte-flow__controls) {
        border: 1px solid oklch(var(--bc) / 0.12);
        border-radius: var(--rounded-box, 0.5rem);
        overflow: hidden;
    }

    .status-machine-flow :global(.svelte-flow__minimap) {
        border: 1px solid oklch(var(--bc) / 0.12);
        border-radius: var(--rounded-box, 0.5rem);
        overflow: hidden;
    }

    .status-machine-flow :global(.svelte-flow__attribution a) {
        color: oklch(var(--bc) / 0.45);
    }

    .status-machine-flow :global(.status-transition-edge) {
        pointer-events: none !important;
    }

    .status-machine-flow :global(.status-transition-edge .svelte-flow__edge-path) {
        pointer-events: none !important;
    }

    .status-machine-flow :global(.status-transition-edge .svelte-flow__edge-interaction) {
        pointer-events: stroke !important;
    }

    .status-machine-flow :global(.svelte-flow__edge-label) {
        color: oklch(var(--bc));
        background: oklch(var(--b1));
        border: 1px solid oklch(var(--bc) / 0.2);
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 11px;
        line-height: 1.2;
    }
</style>
