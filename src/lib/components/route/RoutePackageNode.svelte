<script lang="ts">
    import { Handle, Position, type Node, type NodeProps } from '@xyflow/svelte'
    import DomainIconInline from '$lib/components/DomainIconInline.svelte'
    import type { RouteNodeData } from '$lib/route/buildRouteGraph'
    import { mixDisplayColorInt, resolveTaskColor } from '$lib/grid/colorUtils'
    import {
        ROUTE_PACKAGE_MIN_HEIGHT,
        ROUTE_PACKAGE_MIN_WIDTH,
        ROUTE_PACKAGE_TAB_HEIGHT,
    } from '$lib/route/types'

    type RoutePackageNodeType = Node<RouteNodeData, 'routePackage'>

    let { data, width, height }: NodeProps<RoutePackageNodeType> = $props()

    const nodeWidth = $derived(width ?? ROUTE_PACKAGE_MIN_WIDTH)
    const nodeHeight = $derived(height ?? ROUTE_PACKAGE_MIN_HEIGHT)
    const taskColor = $derived(resolveTaskColor(data.task, data.domains))
    const borderColor = $derived(mixDisplayColorInt(taskColor, ''))

    function handleClick() {
        data.onCardClick?.(data.task)
    }

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
        class="route-package-node nopan pointer-events-none box-border"
        style:width="{nodeWidth}px"
        style:height="{nodeHeight}px"
        onauxclick={handleAuxClick}
        onpointerdown={handlePointerDown}
        oncontextmenu={handleContextMenu}
>
    <Handle type="target" position={Position.Top} class="route-node-handle" />
    <Handle type="source" position={Position.Bottom} class="route-node-handle" />

    <div
            class="route-package-frame pointer-events-none box-border h-full w-full overflow-visible rounded-lg border-2 border-dashed bg-base-100/70"
            class:opacity-60={data.dimmed}
            class:saturate-50={data.dimmed}
            class:ring-2={data.isConnectionSource || data.isDropTarget}
            class:ring-accent={data.isConnectionSource}
            class:ring-success={data.isDropTarget}
            style:border-color={borderColor}
    >
        <div class="route-package-tab-slot shrink-0" style:height="{ROUTE_PACKAGE_TAB_HEIGHT}px">
            <button
                    type="button"
                    class="route-package-tab pointer-events-auto flex h-full max-w-full items-center gap-1.5 rounded-br-lg border border-b-0 px-3 text-left"
                    style:border-color={borderColor}
                    style:background-color={taskColor != null
                        ? `color-mix(in srgb, ${borderColor} 18%, oklch(var(--b1)))`
                        : 'oklch(var(--b2))'}
                    onclick={handleClick}
                    onpointerdown={handlePointerDown}
                    oncontextmenu={handleContextMenu}
            >
                <DomainIconInline domainId={data.task.domain_id} domains={data.domains} size={14} />
                <span class="truncate text-xs font-semibold leading-none">{data.task.title}</span>
                {#if (data.childCount ?? 0) > 0}
                    <span class="badge badge-ghost badge-xs shrink-0">{data.childCount}</span>
                {/if}
            </button>
        </div>
    </div>
</div>

<style>
    .route-package-node :global(.route-node-handle) {
        opacity: 0;
        width: 8px;
        height: 8px;
        min-width: 8px;
        min-height: 8px;
        border: none;
        background: transparent;
    }

    .route-package-tab {
        align-self: flex-start;
        max-width: calc(100% - 1rem);
        min-height: 100%;
    }
</style>
