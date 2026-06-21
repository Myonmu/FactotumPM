<script lang="ts">
    import {
        BaseEdge,
        getStraightPath,
        useStore,
        type Edge,
        type EdgeProps,
    } from '@xyflow/svelte'

    import { getStatusEdgeColorHex } from '$lib/statusMachine/edgeColor'
    import {
        computeStraightEdgeEndpoints,
        labelPointAlongEdge,
    } from '$lib/stateMachine/geometry'

    type StatusTransitionEdgeData = {
        parallelOffset?: number
        color?: number | null
    }

    type StatusTransitionEdge = Edge<StatusTransitionEdgeData, 'statusTransition'>

    let props: EdgeProps<StatusTransitionEdge> = $props()

    const store = useStore()

    let edgeRender = $derived.by(() => {
        const laneOffset = props.data?.parallelOffset ?? 0
        const { source, target } = props

        for (const node of store.nodes) {
            node.position.x
            node.position.y
            node.dragging
        }

        store.nodesInitialized

        const sourceNode = store.nodeLookup.get(source)
        const targetNode = store.nodeLookup.get(target)
        if (!sourceNode || !targetNode) {
            return null
        }

        sourceNode.internals.positionAbsolute.x
        sourceNode.internals.positionAbsolute.y
        targetNode.internals.positionAbsolute.x
        targetNode.internals.positionAbsolute.y
        sourceNode.internals.bounds?.width
        sourceNode.internals.bounds?.height
        targetNode.internals.bounds?.width
        targetNode.internals.bounds?.height
        sourceNode.measured.width
        sourceNode.measured.height
        targetNode.measured.width
        targetNode.measured.height

        const endpoints = computeStraightEdgeEndpoints(
            sourceNode,
            targetNode,
            source,
            target,
            laneOffset,
        )
        if (!endpoints) {
            return null
        }

        const [path] = getStraightPath(endpoints)
        const { labelX, labelY } = labelPointAlongEdge(endpoints)

        return { path, labelX, labelY }
    })

    let pathStyle = $derived.by(() => {
        const targetNode = store.nodeLookup.get(props.target)
        targetNode?.data

        const stroke = getStatusEdgeColorHex(
            props.data?.color,
            targetNode?.data?.color as number | null | undefined,
        )

        return props.selected
            ? `stroke: ${stroke}; stroke-width: 2;`
            : `stroke: ${stroke};`
    })

    function handleEdgePointerDown(event: PointerEvent) {
        event.stopPropagation()

        const selectable = props.selectable ?? store.elementsSelectable
        if (selectable) {
            store.handleEdgeSelection(props.id)
        }
    }
</script>

{#if edgeRender}
    <BaseEdge
        id={props.id}
        path={edgeRender.path}
        labelX={edgeRender.labelX}
        labelY={edgeRender.labelY}
        label={props.label}
        labelStyle={props.labelStyle}
        markerEnd={props.markerEnd}
        interactionWidth={props.interactionWidth ?? 24}
        style={pathStyle}
        onpointerdown={handleEdgePointerDown}
    />
{/if}
