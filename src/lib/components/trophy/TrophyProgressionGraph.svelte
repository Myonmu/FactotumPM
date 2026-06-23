<script lang="ts">
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
    import '$lib/styles/xyflow-theme.css'

    import TrophyProgressionNode, {
        type TrophyNodeData,
    } from '$lib/components/trophy/TrophyProgressionNode.svelte'
    import type { DomainOption, TaskDependencyEdge, TaskRecord } from '$lib/db/dataView'
    import { computeTrophyViewsByTaskId, type TrophyView } from '$lib/trophy/computeTrophies'
    import type { SessionTimeIndex } from '$lib/trophy/trophyTime'
    import { buildTrophyDependencyEdges, layoutTrophyNodes } from '$lib/trophy/buildTrophyGraph'

    const NODE_WIDTH = 240
    const NODE_HEIGHT = 168

    let {
        tasks,
        dependencies,
        domains = [],
        terminalStatusIds,
        sessionTime = null,
        onTrophyClick,
    }: {
        tasks: TaskRecord[]
        dependencies: TaskDependencyEdge[]
        domains?: DomainOption[]
        terminalStatusIds: Set<string>
        sessionTime?: SessionTimeIndex | null
        onTrophyClick?: (view: TrophyView) => void
    } = $props()

    const nodeTypes = { trophyNode: TrophyProgressionNode }

    let nodes = $state.raw<Node<TrophyNodeData>[]>([])
    let edges = $state.raw<Edge[]>([])

    const trophyViews = $derived(computeTrophyViewsByTaskId(tasks, terminalStatusIds, sessionTime))

    $effect(() => {
        const views = trophyViews
        const trophyEdges = buildTrophyDependencyEdges(tasks, dependencies)
        const nodeIds = [...views.keys()]
        const positions = layoutTrophyNodes(nodeIds, trophyEdges, NODE_WIDTH, NODE_HEIGHT)

        nodes = nodeIds.map((id) => {
            const view = views.get(id)!
            return {
                id,
                type: 'trophyNode',
                position: positions.get(id) ?? { x: 0, y: 0 },
                width: NODE_WIDTH,
                data: { view, domains, onClick: onTrophyClick },
            }
        })

        const nodeSet = new Set(nodeIds)
        edges = trophyEdges
            .filter((edge) => nodeSet.has(edge.source) && nodeSet.has(edge.target))
            .map((edge) => ({
                id: edge.id,
                source: edge.source,
                target: edge.target,
                type: 'smoothstep',
                animated: false,
                markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
            }))
    })
</script>

<div class="trophy-graph-flow relative min-h-0 flex-1 rounded-box border border-base-300 bg-base-100">
    {#if nodes.length === 0}
        <div class="flex h-full min-h-[24rem] items-center justify-center p-4">
            <div class="alert alert-info max-w-xl">
                <span>No trophies yet. Mark a task as a trophy to see it here.</span>
            </div>
        </div>
    {:else}
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
                fitView
                minZoom={0.15}
                maxZoom={1.5}
        >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
            <Controls />
            <MiniMap nodeColor={() => 'oklch(var(--p))'} />
            <Panel position="top-left">
                <div class="rounded-box border border-base-300 bg-base-100/95 p-2 text-xs text-base-content/70">
                    <div class="flex items-center gap-2">
                        <span class="text-primary">→</span>
                        Arrow points to the prerequisite (source depends on target)
                    </div>
                    <div class="mt-1">{nodes.length} trophies · {edges.length} links</div>
                </div>
            </Panel>
        </SvelteFlow>
    {/if}
</div>

<style>
    .trophy-graph-flow {
        height: 100%;
        min-height: 24rem;
    }

    .trophy-graph-flow :global(.svelte-flow) {
        width: 100%;
        height: 100%;
        min-height: 24rem;
    }
</style>
