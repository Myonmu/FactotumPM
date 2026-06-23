<script lang="ts">
    import { Handle, Position, type Node, type NodeProps } from '@xyflow/svelte'

    import DomainIconInline from '$lib/components/DomainIconInline.svelte'
    import type { DomainNodeData } from '$lib/domains/buildDomainGraph'
    import { mixDisplayColorInt, resolveDomainColor } from '$lib/grid/colorUtils'

    type DomainNodeType = Node<DomainNodeData, 'domainNode'>

    let { data, selected }: NodeProps<DomainNodeType> = $props()

    const borderColor = $derived(
        mixDisplayColorInt(resolveDomainColor(data.domain.id, data.domains), ''),
    )

    function handleClick() {
        data.onClick?.(data.domain)
    }

    function onPointerDown(event: PointerEvent) {
        if (event.button !== 2) return

        event.preventDefault()
        event.stopPropagation()
        data.onConnectionDragStart?.(data.domain.id, event)
    }

    function onContextMenu(event: MouseEvent) {
        event.preventDefault()
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
        class="domain-node rounded-box border-2 bg-base-100 shadow-md min-w-[12rem] px-3 py-2 cursor-pointer"
        class:border-primary={selected && !data.isConnectionSource && !data.isDropTarget}
        class:ring-2={selected || data.isConnectionSource || data.isDropTarget}
        class:ring-primary={selected && !data.isConnectionSource && !data.isDropTarget}
        class:ring-accent={data.isConnectionSource}
        class:ring-success={data.isDropTarget}
        class:border-accent={data.isConnectionSource}
        class:border-success={data.isDropTarget}
        class:border-base-300={!selected && !data.isConnectionSource && !data.isDropTarget}
        style:border-color={!selected && !data.isConnectionSource && !data.isDropTarget && borderColor
            ? borderColor
            : undefined}
        style:background-color={borderColor
            ? `color-mix(in srgb, ${borderColor} 10%, oklch(var(--b1)))`
            : undefined}
        onclick={handleClick}
        onpointerdown={onPointerDown}
        oncontextmenu={onContextMenu}
>
    <Handle type="target" position={Position.Top} class="domain-node-handle" />
    <Handle type="source" position={Position.Bottom} class="domain-node-handle" />

    <div class="flex items-center gap-2 min-w-0">
        <DomainIconInline domainId={data.domain.id} domains={data.domains} size={18} />
        <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold">{data.domain.name}</p>
            <p class="text-xs text-base-content/60">
                {data.taskCount} {data.taskCount === 1 ? 'task' : 'tasks'}
            </p>
        </div>
    </div>
</div>

<style>
    .domain-node {
        position: relative;
    }

    :global(.domain-node-handle) {
        width: 8px !important;
        height: 8px !important;
        min-width: 0 !important;
        min-height: 0 !important;
        opacity: 0;
        background: transparent !important;
        border: none !important;
    }
</style>
