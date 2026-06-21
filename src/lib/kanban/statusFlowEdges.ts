import { MarkerType, type Edge, type Node } from '@xyflow/svelte'

import {
    computeParallelOffsets,
    getConnectionHandleIds,
    getNodeBoxFromFlowNode,
} from '$lib/stateMachine/geometry'
import type { TaskStatusEdgeRecord } from '$lib/db/taskStatusMachine'

const EDGE_LABEL_STYLE =
    'color: oklch(var(--bc)); background: oklch(var(--b1)); font-size: 11px; padding: 2px 6px; border-radius: 4px; border: 1px solid oklch(var(--bc) / 0.2);'

export const statusFlowDefaultEdgeOptions = {
    type: 'statusTransition' as const,
    markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20 },
    labelStyle: EDGE_LABEL_STYLE,
}

function edgeEndpointsFromEdges(edgeList: Edge[]) {
    return edgeList.map((edge) => ({
        id: edge.id,
        from_status_id: edge.source,
        to_status_id: edge.target,
    }))
}

function resolveEdgeHandles(sourceId: string, targetId: string, nodes: Node[]) {
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

export function statusEdgeToFlowEdge(
    edge: TaskStatusEdgeRecord,
    nodes: Node[],
    parallelOffset = 0,
): Edge {
    const handles = resolveEdgeHandles(edge.from_status_id, edge.to_status_id, nodes)

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
        selectable: false,
        focusable: false,
        data: {
            parallelOffset,
            color: edge.color ?? undefined,
        },
    }
}

export function refreshStatusFlowEdgeHandles(edgeList: Edge[], nodes: Node[]): Edge[] {
    return edgeList.map((edge) => {
        const handles = resolveEdgeHandles(edge.source, edge.target, nodes)

        return {
            ...edge,
            sourceHandle: handles.sourceHandle,
            targetHandle: handles.targetHandle,
        }
    })
}

export function applyStatusFlowParallelOffsets(edgeList: Edge[], nodes: Node[]): Edge[] {
    const offsets = computeParallelOffsets(edgeEndpointsFromEdges(edgeList))

    return refreshStatusFlowEdgeHandles(
        edgeList.map((edge) => ({
            ...edge,
            type: 'statusTransition',
            class: edge.class ?? 'status-transition-edge',
            interactionWidth: edge.interactionWidth ?? 24,
            selectable: false,
            focusable: false,
            data: {
                ...(edge.data ?? {}),
                parallelOffset: offsets.get(edge.id) ?? 0,
            },
        })),
        nodes,
    )
}

export function buildStatusFlowEdges(
    records: TaskStatusEdgeRecord[],
    nodes: Node[],
): Edge[] {
    const offsets = computeParallelOffsets(
        records.map((edge) => ({
            id: edge.id,
            from_status_id: edge.from_status_id,
            to_status_id: edge.to_status_id,
        })),
    )

    return records.map((edge) =>
        statusEdgeToFlowEdge(edge, nodes, offsets.get(edge.id) ?? 0),
    )
}
