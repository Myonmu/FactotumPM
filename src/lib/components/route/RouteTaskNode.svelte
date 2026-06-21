<script lang="ts">
    import { Handle, Position, type Node, type NodeProps } from '@xyflow/svelte'

    import RouteTaskCard from '$lib/components/route/RouteTaskCard.svelte'
    import type { RouteNodeData } from '$lib/route/buildRouteGraph'
    import { ROUTE_NODE_WIDTH } from '$lib/route/types'

    type RouteTaskNodeType = Node<RouteNodeData, 'routeTask'>

    let { data, width, height }: NodeProps<RouteTaskNodeType> = $props()

    const nodeWidth = $derived(width ?? ROUTE_NODE_WIDTH)
    const nodeHeight = $derived(height ?? 56)

    function handleAuxClick(event: MouseEvent) {
        if (event.button !== 1) return

        event.preventDefault()
        event.stopPropagation()
        data.onMiddleClick?.(data.task)
    }

    function handlePointerDown(event: PointerEvent) {
        if (event.button === 1) {
            event.preventDefault()
            return
        }

        if (event.button !== 2) return

        event.preventDefault()
        event.stopPropagation()
        data.onConnectionDragStart?.(data.task.id, event)
    }

    function handleContextMenu(event: MouseEvent) {
        event.preventDefault()
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
        class="route-task-node nopan box-border cursor-grab rounded-box active:cursor-grabbing"
        class:ring-2={data.isConnectionSource || data.isDropTarget}
        class:ring-accent={data.isConnectionSource}
        class:ring-success={data.isDropTarget}
        style:width="{nodeWidth}px"
        style:height="{nodeHeight}px"
        onauxclick={handleAuxClick}
        onpointerdown={handlePointerDown}
        oncontextmenu={handleContextMenu}
>
    <Handle type="target" position={Position.Top} class="route-node-handle" />
    <Handle type="source" position={Position.Bottom} class="route-node-handle" />

    <RouteTaskCard
            task={data.task}
            domains={data.domains}
            dimmed={Boolean(data.dimmed)}
            onClick={() => data.onCardClick?.(data.task)}
    />
</div>

<style>
    .route-task-node :global(.route-node-handle) {
        opacity: 0;
        width: 8px;
        height: 8px;
        min-width: 8px;
        min-height: 8px;
        border: none;
        background: transparent;
    }
</style>
