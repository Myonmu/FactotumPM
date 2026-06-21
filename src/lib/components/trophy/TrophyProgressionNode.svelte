<script lang="ts" module>
    import type { DomainOption } from '$lib/db/dataView'
    import type { TrophyView } from '$lib/trophy/computeTrophies'

    export type TrophyNodeData = {
        view: TrophyView
        domains: DomainOption[]
        onClick?: (view: TrophyView) => void
    }
</script>

<script lang="ts">
    import { Handle, Position, type Node, type NodeProps } from '@xyflow/svelte'

    import TrophyCard from '$lib/components/trophy/TrophyCard.svelte'

    type TrophyNodeType = Node<TrophyNodeData, 'trophyNode'>

    let { data, width }: NodeProps<TrophyNodeType> = $props()

    const nodeWidth = $derived(width ?? 240)
</script>

<div class="trophy-progression-node nopan" style:width="{nodeWidth}px">
    <Handle type="target" position={Position.Top} class="trophy-node-handle" />
    <Handle type="source" position={Position.Bottom} class="trophy-node-handle" />

    <TrophyCard view={data.view} domains={data.domains} onClick={() => data.onClick?.(data.view)} />
</div>

<style>
    .trophy-progression-node :global(.trophy-node-handle) {
        opacity: 0;
        width: 8px;
        height: 8px;
        min-width: 8px;
        min-height: 8px;
        border: none;
        background: transparent;
    }
</style>
