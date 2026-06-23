<script lang="ts">
    import { Handle, Position, type Node, type NodeProps } from '@xyflow/svelte'
    import { Flag, CircleStop } from 'lucide-svelte'

    import { colorIntToHex } from '$lib/grid/colorUtils'

    type StatusNodeData = {
        label: string
        description?: string | null
        color?: number | null
        isInitial?: boolean
        isTerminal?: boolean
        isConnectionSource?: boolean
        isDropTarget?: boolean
        onRename?: (id: string, name: string) => void
        onConnectionDragStart?: (id: string, event: PointerEvent) => void
    }

    type StatusNodeType = Node<StatusNodeData, 'status'>

    let { id, data, selected }: NodeProps<StatusNodeType> = $props()

    let editing = $state(false)
    let draftName = $state(data.label)

    let statusColor = $derived(colorIntToHex(data.color))
    let useCustomColor = $derived(
        !!statusColor && !data.isConnectionSource && !data.isDropTarget,
    )
    let nodeStyle = $derived.by(() => {
        if (!useCustomColor || !statusColor) return undefined

        if (selected) {
            return `border-color: ${statusColor}; box-shadow: 0 0 0 2px color-mix(in srgb, ${statusColor} 55%, transparent);`
        }

        return `border-color: ${statusColor}; background: color-mix(in srgb, ${statusColor} 12%, oklch(var(--b1)));`
    })

    $effect(() => {
        if (!editing) {
            draftName = data.label
        }
    })

    function commitName() {
        editing = false
        const trimmed = draftName.trim()
        if (trimmed && trimmed !== data.label) {
            data.onRename?.(id, trimmed)
        } else {
            draftName = data.label
        }
    }

    function onPointerDown(event: PointerEvent) {
        if (event.button !== 2) return

        event.preventDefault()
        event.stopPropagation()
        data.onConnectionDragStart?.(id, event)
    }

    function onContextMenu(event: MouseEvent) {
        event.preventDefault()
    }
</script>

<div
    class="status-node rounded-box border-2 bg-base-100 shadow-md min-w-36 px-3 py-2"
    class:border-primary={selected && !useCustomColor && !data.isConnectionSource && !data.isDropTarget}
    class:ring-2={selected || data.isConnectionSource || data.isDropTarget}
    class:ring-primary={selected && !useCustomColor && !data.isConnectionSource && !data.isDropTarget}
    class:ring-accent={data.isConnectionSource}
    class:ring-success={data.isDropTarget}
    class:border-accent={data.isConnectionSource}
    class:border-success={data.isDropTarget}
    class:border-base-300={!selected && !useCustomColor && !data.isConnectionSource && !data.isDropTarget}
    style={nodeStyle}
    onpointerdown={onPointerDown}
    oncontextmenu={onContextMenu}
>
    <!-- Side handles align xyflow layout coords with border snapping -->
    <Handle
        type="target"
        position={Position.Top}
        id="connect-target-top"
        class="status-node-handle-side"
    />
    <Handle
        type="target"
        position={Position.Right}
        id="connect-target-right"
        class="status-node-handle-side"
    />
    <Handle
        type="target"
        position={Position.Bottom}
        id="connect-target-bottom"
        class="status-node-handle-side"
    />
    <Handle
        type="target"
        position={Position.Left}
        id="connect-target-left"
        class="status-node-handle-side"
    />
    <Handle
        type="source"
        position={Position.Top}
        id="connect-source-top"
        class="status-node-handle-side"
    />
    <Handle
        type="source"
        position={Position.Right}
        id="connect-source-right"
        class="status-node-handle-side"
    />
    <Handle
        type="source"
        position={Position.Bottom}
        id="connect-source-bottom"
        class="status-node-handle-side"
    />
    <Handle
        type="source"
        position={Position.Left}
        id="connect-source-left"
        class="status-node-handle-side"
    />

    <div class="status-node-content">
        <div class="flex items-center gap-2">
            {#if data.isInitial}
                <span class="tooltip tooltip-right" data-tip="Initial status">
                    <Flag class="w-4 h-4 shrink-0 text-warning" />
                </span>
            {/if}

            {#if data.isTerminal}
                <span class="tooltip tooltip-right" data-tip="Terminal status">
                    <CircleStop class="w-4 h-4 shrink-0 text-base-content/50" />
                </span>
            {/if}

            {#if editing}
                <input
                    class="nodrag nopan input input-xs input-bordered w-full"
                    bind:value={draftName}
                    onblur={commitName}
                    onkeydown={(event) => {
                        if (event.key === 'Enter') commitName()
                        if (event.key === 'Escape') {
                            draftName = data.label
                            editing = false
                        }
                    }}
                />
            {:else}
                <button
                    type="button"
                    class="nodrag nopan font-semibold text-left truncate hover:underline"
                    title="Double-click to rename"
                    ondblclick={() => {
                        editing = true
                    }}
                >
                    {data.label}
                </button>
            {/if}
        </div>

        {#if data.description}
            <p class="text-xs text-base-content/60 mt-1 line-clamp-2">{data.description}</p>
        {/if}
    </div>
</div>

<style>
    .status-node {
        position: relative;
        cursor: grab;
    }

    .status-node-content {
        position: relative;
        z-index: 3;
        pointer-events: none;
    }

    .status-node-content :global(.nodrag),
    .status-node-content :global(input),
    .status-node-content :global(button),
    .status-node-content :global(textarea) {
        pointer-events: auto;
    }

    :global(.status-node-handle-side) {
        width: 10px !important;
        height: 10px !important;
        min-width: 0 !important;
        min-height: 0 !important;
        opacity: 0;
        background: transparent !important;
        border: none !important;
        z-index: 2;
    }
</style>
