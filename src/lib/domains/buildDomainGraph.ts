import dagre from '@dagrejs/dagre'
import { MarkerType, Position, type Edge, type Node } from '@xyflow/svelte'

import type { DomainRecord } from '$lib/db/domains'
import type { DomainOption } from '$lib/db/dataView'

export type DomainNodeData = {
    domain: DomainRecord
    domains: DomainOption[]
    taskCount: number
    isConnectionSource?: boolean
    isDropTarget?: boolean
    onClick?: (domain: DomainRecord) => void
    onConnectionDragStart?: (domainId: string, event: PointerEvent) => void
}

const NODE_WIDTH = 200
const NODE_HEIGHT = 56

export function buildDomainGraphElements(
    domains: DomainRecord[],
    domainOptions: DomainOption[],
    taskCounts: Map<string, number>,
    callbacks: {
        onNodeClick?: (domain: DomainRecord) => void
        onConnectionDragStart?: (domainId: string, event: PointerEvent) => void
        connectionDragSourceId?: string | null
        connectionDropTargetId?: string | null
    } = {},
): { nodes: Node<DomainNodeData>[]; edges: Edge[] } {
    const nodes: Node<DomainNodeData>[] = domains.map((entry) => ({
        id: entry.id,
        type: 'domainNode',
        position: { x: 0, y: 0 },
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        data: {
            domain: entry,
            domains: domainOptions,
            taskCount: taskCounts.get(entry.id) ?? 0,
            isConnectionSource: entry.id === callbacks.connectionDragSourceId,
            isDropTarget:
                entry.id === callbacks.connectionDropTargetId
                && entry.id !== callbacks.connectionDragSourceId,
            onClick: callbacks.onNodeClick,
            onConnectionDragStart: callbacks.onConnectionDragStart,
        },
    }))

    const domainIds = new Set(domains.map((entry) => entry.id))
    const edges: Edge[] = []

    for (const entry of domains) {
        if (!entry.parent_domain_id || !domainIds.has(entry.parent_domain_id)) continue

        edges.push({
            id: `domain:${entry.parent_domain_id}->${entry.id}`,
            source: entry.parent_domain_id,
            target: entry.id,
            type: 'smoothstep',
            zIndex: 0,
            markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 16,
                height: 16,
                color: null,
            },
        })
    }

    const positions = layoutDomainNodes(
        nodes.map((node) => node.id),
        edges,
        NODE_WIDTH,
        NODE_HEIGHT,
    )

    for (const node of nodes) {
        const position = positions.get(node.id)
        if (position) node.position = position
    }

    return { nodes, edges }
}

export function layoutDomainNodes(
    nodeIds: string[],
    edges: Edge[],
    nodeWidth: number,
    nodeHeight: number,
): Map<string, { x: number; y: number }> {
    const graph = new dagre.graphlib.Graph()
    graph.setDefaultEdgeLabel(() => ({}))
    graph.setGraph({ rankdir: 'TB', nodesep: 48, ranksep: 72, marginx: 24, marginy: 24 })

    for (const id of nodeIds) {
        graph.setNode(id, { width: nodeWidth, height: nodeHeight })
    }

    const nodeSet = new Set(nodeIds)
    for (const edge of edges) {
        if (nodeSet.has(edge.source) && nodeSet.has(edge.target)) {
            graph.setEdge(edge.source, edge.target)
        }
    }

    dagre.layout(graph)

    const positions = new Map<string, { x: number; y: number }>()
    for (const id of nodeIds) {
        const node = graph.node(id)
        positions.set(id, {
            x: node.x - nodeWidth / 2,
            y: node.y - nodeHeight / 2,
        })
    }

    return positions
}
