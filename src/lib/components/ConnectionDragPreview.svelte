<script lang="ts">
    import { ViewportPortal, useStore, useSvelteFlow } from '@xyflow/svelte'

    import { getBorderPoint, getNodeBox } from '$lib/stateMachine/geometry'

    type DragState = {
        sourceId: string
        clientX: number
        clientY: number
    }

    let { drag }: { drag: DragState | null } = $props()

    const store = useStore()
    const { screenToFlowPosition } = useSvelteFlow()

    let preview = $derived.by(() => {
        if (!drag) return null

        for (const node of store.nodes) {
            node.position.x
            node.position.y
        }

        const sourceNode = store.nodeLookup.get(drag.sourceId)
        if (!sourceNode) return null

        const pointer = screenToFlowPosition(
            { x: drag.clientX, y: drag.clientY },
            { snapToGrid: false },
        )
        const sourceBox = getNodeBox(sourceNode)
        const sourceBorder = getBorderPoint(sourceBox, pointer)

        return {
            x1: sourceBorder.x,
            y1: sourceBorder.y,
            x2: pointer.x,
            y2: pointer.y,
        }
    })
</script>

<ViewportPortal>
    {#if preview}
        <svg class="connection-drag-preview" aria-hidden="true">
            <line
                x1={preview.x1}
                y1={preview.y1}
                x2={preview.x2}
                y2={preview.y2}
            />
        </svg>
    {/if}
</ViewportPortal>

<style>
    .connection-drag-preview {
        position: absolute;
        inset: 0;
        overflow: visible;
        pointer-events: none;
    }

    .connection-drag-preview line {
        stroke: oklch(var(--a));
        stroke-width: 2;
        stroke-dasharray: 6 4;
    }
</style>
