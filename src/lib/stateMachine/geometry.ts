import { Position, type InternalNode, type Node } from '@xyflow/svelte'

export type NodeBox = {
    x: number
    y: number
    width: number
    height: number
}

export type BorderPoint = {
    x: number
    y: number
    position: Position
}

export type StraightEdgePath = {
    sourceX: number
    sourceY: number
    targetX: number
    targetY: number
}

type EdgeEndpoint = {
    id: string
    from_status_id: string
    to_status_id: string
}

/** Perpendicular gap between parallel edges that share the same two nodes. */
export const EDGE_LANE_SEPARATION = 32

/** Fraction along the edge from source toward target where labels are placed. */
export const EDGE_LABEL_ANCHOR = 0.3

const DEFAULT_NODE_WIDTH = 144
const DEFAULT_NODE_HEIGHT = 48

function positionToHandleSuffix(position: Position): string {
    switch (position) {
        case Position.Right:
            return 'right'
        case Position.Bottom:
            return 'bottom'
        case Position.Left:
            return 'left'
        default:
            return 'top'
    }
}

export function getNodeBoxFromFlowNode(node: Node): NodeBox {
    const width = node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH
    const height = node.measured?.height ?? node.height ?? DEFAULT_NODE_HEIGHT

    return {
        x: node.position.x,
        y: node.position.y,
        width: width > 0 ? width : DEFAULT_NODE_WIDTH,
        height: height > 0 ? height : DEFAULT_NODE_HEIGHT,
    }
}

export function getNodeBox(node: InternalNode<Node>): NodeBox {
    const bounds = node.internals.bounds
    const width =
        bounds?.width && bounds.width > 0
            ? bounds.width
            : (node.measured.width ?? node.width ?? DEFAULT_NODE_WIDTH)
    const height =
        bounds?.height && bounds.height > 0
            ? bounds.height
            : (node.measured.height ?? node.height ?? DEFAULT_NODE_HEIGHT)

    return {
        x: node.internals.positionAbsolute.x,
        y: node.internals.positionAbsolute.y,
        width: width > 0 ? width : DEFAULT_NODE_WIDTH,
        height: height > 0 ? height : DEFAULT_NODE_HEIGHT,
    }
}

export function getNodeCenter(box: NodeBox): { x: number; y: number } {
    return {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
    }
}

function getEdgePosition(box: NodeBox, point: { x: number; y: number }): Position {
    const center = getNodeCenter(box)
    const dx = point.x - center.x
    const dy = point.y - center.y

    const widthRatio = Math.abs(dx) / (box.width / 2)
    const heightRatio = Math.abs(dy) / (box.height / 2)

    if (widthRatio > heightRatio) {
        return dx > 0 ? Position.Right : Position.Left
    }

    return dy > 0 ? Position.Bottom : Position.Top
}

/** Ray from node center toward a point; returns where it meets the node rectangle border. */
export function getBorderPoint(
    box: NodeBox,
    toward: { x: number; y: number },
): BorderPoint {
    const center = getNodeCenter(box)
    const dx = toward.x - center.x
    const dy = toward.y - center.y

    if (dx === 0 && dy === 0) {
        return { x: center.x, y: box.y, position: Position.Top }
    }

    const halfWidth = box.width / 2
    const halfHeight = box.height / 2
    const scaleX = dx !== 0 ? halfWidth / Math.abs(dx) : Number.POSITIVE_INFINITY
    const scaleY = dy !== 0 ? halfHeight / Math.abs(dy) : Number.POSITIVE_INFINITY
    const scale = Math.min(scaleX, scaleY)

    const point = {
        x: center.x + dx * scale,
        y: center.y + dy * scale,
    }

    return {
        ...point,
        position: getEdgePosition(box, point),
    }
}

type Point = { x: number; y: number }

function pointOnRectBoundary(box: NodeBox, point: Point, epsilon = 0.5): boolean {
    const left = box.x
    const right = box.x + box.width
    const top = box.y
    const bottom = box.y + box.height

    const onVertical =
        Math.abs(point.x - left) <= epsilon || Math.abs(point.x - right) <= epsilon
    const onHorizontal =
        Math.abs(point.y - top) <= epsilon || Math.abs(point.y - bottom) <= epsilon

    return (
        point.x >= left - epsilon &&
        point.x <= right + epsilon &&
        point.y >= top - epsilon &&
        point.y <= bottom + epsilon &&
        (onVertical || onHorizontal)
    )
}

/** Intersect a segment with one axis-aligned rectangle edge; t is on [segStart, segEnd]. */
function intersectSegmentWithHorizontal(
    segStart: Point,
    segDelta: Point,
    y: number,
    xMin: number,
    xMax: number,
): { point: Point; t: number } | null {
    if (Math.abs(segDelta.y) < 1e-9) return null

    const t = (y - segStart.y) / segDelta.y
    if (t < 0 || t > 1) return null

    const x = segStart.x + segDelta.x * t
    if (x < xMin - 0.5 || x > xMax + 0.5) return null

    return { point: { x, y }, t }
}

function intersectSegmentWithVertical(
    segStart: Point,
    segDelta: Point,
    x: number,
    yMin: number,
    yMax: number,
): { point: Point; t: number } | null {
    if (Math.abs(segDelta.x) < 1e-9) return null

    const t = (x - segStart.x) / segDelta.x
    if (t < 0 || t > 1) return null

    const y = segStart.y + segDelta.y * t
    if (y < yMin - 0.5 || y > yMax + 0.5) return null

    return { point: { x, y }, t }
}

/** Where a chord segment crosses a rectangle border. */
function chordRectBorderHits(
    box: NodeBox,
    segStart: Point,
    segDelta: Point,
): Array<{ point: Point; t: number }> {
    const left = box.x
    const right = box.x + box.width
    const top = box.y
    const bottom = box.y + box.height

    const edges = [
        intersectSegmentWithHorizontal(segStart, segDelta, top, left, right),
        intersectSegmentWithHorizontal(segStart, segDelta, bottom, left, right),
        intersectSegmentWithVertical(segStart, segDelta, left, top, bottom),
        intersectSegmentWithVertical(segStart, segDelta, right, top, bottom),
    ]

    const hits: Array<{ point: Point; t: number }> = []
    for (const hit of edges) {
        if (hit && pointOnRectBoundary(box, hit.point)) {
            hits.push(hit)
        }
    }

    return hits
}

/**
 * Snap to borders on the center chord, offset the chord perpendicular for parallel
 * lanes, then clip back to each node rectangle so endpoints stay on the contour.
 */
export function computeStraightEdgeEndpoints(
    sourceNode: InternalNode<Node>,
    targetNode: InternalNode<Node>,
    sourceId: string,
    targetId: string,
    laneOffset = 0,
): StraightEdgePath | null {
    const sourceBox = getNodeBox(sourceNode)
    const targetBox = getNodeBox(targetNode)
    const sourceCenter = getNodeCenter(sourceBox)
    const targetCenter = getNodeCenter(targetBox)

    const sourceBorder = getBorderPoint(sourceBox, targetCenter)
    const targetBorder = getBorderPoint(targetBox, sourceCenter)

    if (laneOffset === 0) {
        return {
            sourceX: sourceBorder.x,
            sourceY: sourceBorder.y,
            targetX: targetBorder.x,
            targetY: targetBorder.y,
        }
    }

    const pairNormal = getPairNormal(sourceId, targetId, sourceCenter, targetCenter)
    const length = Math.hypot(pairNormal.dx, pairNormal.dy) || 1
    const perpX = (-pairNormal.dy / length) * laneOffset
    const perpY = (pairNormal.dx / length) * laneOffset

    const chordDelta = {
        x: targetBorder.x - sourceBorder.x,
        y: targetBorder.y - sourceBorder.y,
    }
    const laneOrigin = {
        x: sourceBorder.x + perpX,
        y: sourceBorder.y + perpY,
    }

    const sourceHits = chordRectBorderHits(sourceBox, laneOrigin, chordDelta)
    const targetHits = chordRectBorderHits(targetBox, laneOrigin, chordDelta)

    const snappedSource = sourceHits.length
        ? sourceHits.reduce((best, hit) => (hit.t < best.t ? hit : best))
        : null
    const snappedTarget = targetHits.length
        ? targetHits.reduce((best, hit) => (hit.t > best.t ? hit : best))
        : null

    const fallbackSource = getBorderPoint(sourceBox, {
        x: targetCenter.x + perpX,
        y: targetCenter.y + perpY,
    })
    const fallbackTarget = getBorderPoint(targetBox, {
        x: sourceCenter.x + perpX,
        y: sourceCenter.y + perpY,
    })

    return {
        sourceX: snappedSource?.point.x ?? fallbackSource.x,
        sourceY: snappedSource?.point.y ?? fallbackSource.y,
        targetX: snappedTarget?.point.x ?? fallbackTarget.x,
        targetY: snappedTarget?.point.y ?? fallbackTarget.y,
    }
}

export function labelPointAlongEdge(
    endpoints: StraightEdgePath,
    anchor = EDGE_LABEL_ANCHOR,
): { labelX: number; labelY: number } {
    const { sourceX, sourceY, targetX, targetY } = endpoints

    return {
        labelX: sourceX + (targetX - sourceX) * anchor,
        labelY: sourceY + (targetY - sourceY) * anchor,
    }
}

export function buildStraightEdgePath(endpoints: StraightEdgePath): {
    path: string
    labelX: number
    labelY: number
} {
    const { sourceX, sourceY, targetX, targetY } = endpoints
    const { labelX, labelY } = labelPointAlongEdge(endpoints)

    return {
        path: `M${sourceX},${sourceY} L${targetX},${targetY}`,
        labelX,
        labelY,
    }
}

export function computeStraightEdgePath(
    sourceNode: InternalNode<Node>,
    targetNode: InternalNode<Node>,
    sourceId: string,
    targetId: string,
    laneOffset = 0,
): { path: string; labelX: number; labelY: number } | null {
    const endpoints = computeStraightEdgeEndpoints(
        sourceNode,
        targetNode,
        sourceId,
        targetId,
        laneOffset,
    )

    if (!endpoints) {
        return null
    }

    return buildStraightEdgePath(endpoints)
}

export function getConnectionHandleIds(
    sourceBox: NodeBox,
    targetBox: NodeBox,
    sourceId: string,
    targetId: string,
): { sourceHandle: string; targetHandle: string } {
    const sourceCenter = getNodeCenter(sourceBox)
    const targetCenter = getNodeCenter(targetBox)

    const sourceSide = getEdgePosition(sourceBox, targetCenter)
    const targetSide = getEdgePosition(targetBox, sourceCenter)

    return {
        sourceHandle: `connect-source-${positionToHandleSuffix(sourceSide)}`,
        targetHandle: `connect-target-${positionToHandleSuffix(targetSide)}`,
    }
}

export type PairNormal = {
    dx: number
    dy: number
}

/** Canonical chord direction for a node pair (lower id → higher id). */
export function getPairNormal(
    sourceId: string,
    targetId: string,
    sourceCenter: { x: number; y: number },
    targetCenter: { x: number; y: number },
): PairNormal {
    if (sourceId < targetId) {
        return {
            dx: targetCenter.x - sourceCenter.x,
            dy: targetCenter.y - sourceCenter.y,
        }
    }

    return {
        dx: sourceCenter.x - targetCenter.x,
        dy: sourceCenter.y - targetCenter.y,
    }
}

function pairKey(from: string, to: string): string {
    return [from, to].sort().join('::')
}

function sortEndpointsForPair(edges: EdgeEndpoint[]): EdgeEndpoint[] {
    return [...edges].sort((a, b) => {
        const fromCmp = a.from_status_id.localeCompare(b.from_status_id)
        if (fromCmp !== 0) return fromCmp
        return a.to_status_id.localeCompare(b.to_status_id)
    })
}

/** Spread parallel offsets for all edges that connect the same two nodes. */
export function computeParallelOffsets(endpoints: EdgeEndpoint[]): Map<string, number> {
    const offsets = new Map<string, number>()
    const byPair = new Map<string, EdgeEndpoint[]>()

    for (const edge of endpoints) {
        const key = pairKey(edge.from_status_id, edge.to_status_id)
        const group = byPair.get(key)
        if (group) {
            group.push(edge)
        } else {
            byPair.set(key, [edge])
        }
    }

    for (const group of byPair.values()) {
        const sorted = sortEndpointsForPair(group)
        const count = sorted.length

        for (let index = 0; index < count; index++) {
            const laneOffset = (index - (count - 1) / 2) * EDGE_LANE_SEPARATION
            offsets.set(sorted[index].id, laneOffset)
        }
    }

    return offsets
}

export function parallelOffsetForNewEdge(
    source: string,
    target: string,
    existing: EdgeEndpoint[],
): number {
    const prospective = [
        ...existing,
        { id: 'pending', from_status_id: source, to_status_id: target },
    ]

    return computeParallelOffsets(prospective).get('pending') ?? 0
}
