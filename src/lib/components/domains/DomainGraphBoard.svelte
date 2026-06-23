<script lang="ts">
    import { onMount } from 'svelte'
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
    import { RefreshCw } from 'lucide-svelte'

    import ConnectionDragPreview from '$lib/components/ConnectionDragPreview.svelte'
    import DomainEditor from '$lib/components/domains/DomainEditor.svelte'
    import DomainNode from '$lib/components/domains/DomainNode.svelte'
    import {
        buildDomainGraphElements,
        type DomainNodeData,
    } from '$lib/domains/buildDomainGraph'
    import {
        createDomain,
        deleteDomain,
        loadDomains,
        updateDomain,
        type DomainRecord,
    } from '$lib/db/domains'
    import { loadDomainOptions, type DomainOption } from '$lib/db/dataView'
    import { fetchTableRows, recordToTask } from '$lib/db/dataView'
    import { colorIntToHex, resolveDomainColor } from '$lib/grid/colorUtils'
    import { closeInspector, openInspector, updateInspectorProps } from '$lib/inspector.svelte'
    import { getCurrentProjectId } from '$lib/projectState.svelte'

    const nodeTypes = { domainNode: DomainNode }

    let {
        onCreateDomain,
    }: {
        onCreateDomain?: () => void | Promise<void>
    } = $props()

    const currentProjectId = $derived(getCurrentProjectId())

    let nodes = $state<Node<DomainNodeData>[]>([])
    let edges = $state<Edge[]>([])
    let domainRecords = $state<DomainRecord[]>([])
    let domainOptions = $state<DomainOption[]>([])
    let taskCounts = $state<Map<string, number>>(new Map())
    let loading = $state(true)
    let error = $state<string | null>(null)
    let actionLoading = $state(false)
    let connectionDragSourceId = $state<string | null>(null)
    let connectionDragClient = $state<{ clientX: number; clientY: number } | null>(null)
    let connectionDropTargetId = $state<string | null>(null)

    const connectionDrag = $derived(
        connectionDragSourceId && connectionDragClient
            ? {
                  sourceId: connectionDragSourceId,
                  clientX: connectionDragClient.clientX,
                  clientY: connectionDragClient.clientY,
              }
            : null,
    )

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
            void reparentDomain(source, target)
        }
    }

    async function reparentDomain(childId: string, parentId: string) {
        actionLoading = true
        error = null

        try {
            await updateDomain(childId, { parent_domain_id: parentId })
            await reload()
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to update domain parent'
        } finally {
            actionLoading = false
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
            connectionDropTargetId = findNodeIdAtClientPoint(event.clientX, event.clientY)
            syncConnectionHighlights()
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

    function rebuildGraph() {
        const built = buildDomainGraphElements(
            domainRecords,
            domainOptions,
            taskCounts,
            {
                onNodeClick: (domain) => void openDomainInspector(domain),
                onConnectionDragStart: handleConnectionDragStart,
                connectionDragSourceId,
                connectionDropTargetId,
            },
        )

        nodes = built.nodes
        edges = built.edges
    }

    async function reload() {
        loading = true
        error = null

        try {
            const projectId = currentProjectId
            const [loadedDomains, loadedOptions, taskResult] = await Promise.all([
                loadDomains(projectId),
                loadDomainOptions(projectId),
                fetchTableRows('task', projectId),
            ])

            domainRecords = loadedDomains
            domainOptions = loadedOptions

            const counts = new Map<string, number>()
            for (const entry of loadedDomains) {
                counts.set(entry.id, 0)
            }
            for (const row of taskResult.rows) {
                const task = recordToTask(row)
                if (task.domain_id && counts.has(task.domain_id)) {
                    counts.set(task.domain_id, (counts.get(task.domain_id) ?? 0) + 1)
                }
            }
            taskCounts = counts

            rebuildGraph()
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to load domain graph'
        } finally {
            loading = false
        }
    }

    export async function createAndInspectDomain() {
        actionLoading = true
        error = null

        try {
            const created = await createDomain()
            await reload()
            await openDomainInspector(created)
            onCreateDomain?.()
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to create domain'
        } finally {
            actionLoading = false
        }
    }

    async function openDomainInspector(record: DomainRecord) {
        openInspector(
            DomainEditor,
            {
                domain: record,
                domains: domainOptions,
                saving: actionLoading,
                onSave: (patch) => handleDomainSave(record.id, patch),
                onDelete: () => handleDomainDelete(record.id),
                onCancel: closeInspector,
            },
            'Domain Inspector',
        )
    }

    async function handleDomainSave(
        domainId: string,
        patch: {
            name: string
            description: string | null
            color: number | null
            icon: string | null
            parent_domain_id: string | null
            project_id: string | null
        },
    ) {
        actionLoading = true
        error = null

        try {
            await updateDomain(domainId, patch)
            await reload()
            const updated = domainRecords.find((entry) => entry.id === domainId)
            if (updated) {
                updateInspectorProps({ domain: updated, domains: domainOptions })
            }
        } finally {
            actionLoading = false
        }
    }

    async function handleDomainDelete(domainId: string) {
        actionLoading = true
        error = null

        try {
            await deleteDomain(domainId)
            closeInspector()
            await reload()
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to delete domain'
            throw err
        } finally {
            actionLoading = false
        }
    }

    function onPaneContextMenu(event: MouseEvent) {
        event.preventDefault()
    }

    let initialized = false

    onMount(() => {
        void reload().then(() => { initialized = true })
    })

    $effect(() => {
        const _pid = currentProjectId
        if (initialized) void reload()
    })
</script>

<div class="flex h-full min-h-0 flex-col gap-3">
    {#if error}
        <div class="alert alert-error py-2 text-sm shrink-0">
            <span>{error}</span>
        </div>
    {/if}

    <div class="domain-graph-flow relative min-h-0 flex-1 rounded-box border border-base-300 bg-base-100">
        {#if loading}
            <div class="flex h-full min-h-[24rem] items-center justify-center">
                <span class="loading loading-spinner loading-lg text-primary"></span>
            </div>
        {:else if domainRecords.length === 0}
            <div class="flex h-full min-h-[24rem] items-center justify-center p-4">
                <div class="alert alert-info max-w-xl">
                    <span>No domains yet. Create a domain to map your task areas.</span>
                </div>
            </div>
        {:else}
            <SvelteFlow
                    bind:nodes
                    bind:edges
                    {nodeTypes}
                    nodesConnectable={false}
                    panOnDrag={[0]}
                    fitView
                    onpanecontextmenu={onPaneContextMenu}
            >
                <ConnectionDragPreview drag={connectionDrag} />
                <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
                <Controls />
                <MiniMap
                        nodeColor={(node) =>
                            colorIntToHex(resolveDomainColor(String(node.id), domainOptions))
                            ?? 'oklch(var(--p))'}
                />
                <Panel position="top-left">
                    <div class="badge badge-outline bg-base-100/90">
                        {domainRecords.length} domains · {edges.length} links
                    </div>
                </Panel>
                <Panel position="top-right">
                    <div class="flex gap-2">
                        <button
                                class="btn btn-sm btn-ghost"
                                disabled={loading}
                                onclick={() => void reload()}
                        >
                            <RefreshCw class="h-4 w-4" />
                        </button>
                    </div>
                </Panel>
            </SvelteFlow>
        {/if}
    </div>

    {#if connectionDragSourceId}
        <p class="text-xs text-accent shrink-0">
            Release on a parent domain to move this subdomain under it.
        </p>
    {/if}
</div>

<style>
    .domain-graph-flow {
        height: 100%;
        min-height: 24rem;
    }

    .domain-graph-flow :global(.svelte-flow) {
        width: 100%;
        height: 100%;
        min-height: 24rem;
    }

    .domain-graph-flow :global(.svelte-flow__pane) {
        cursor: grab;
    }

    .domain-graph-flow :global(.svelte-flow__pane:active) {
        cursor: grabbing;
    }
</style>
