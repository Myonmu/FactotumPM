import dagre from '@dagrejs/dagre'
import type { Edge, Node } from '@xyflow/svelte'

import type { TaskRecord } from '$lib/db/dataView'

import { estimateRouteTaskNodeSize } from './routeTaskNodeSize'
import {
    ROUTE_CHILD_GAP,
    ROUTE_NODE_WIDTH,
    ROUTE_PACKAGE_BOTTOM_PADDING,
    ROUTE_PACKAGE_CONTENT_TOP,
    ROUTE_PACKAGE_LAYOUT_BUFFER,
    ROUTE_PACKAGE_MIN_HEIGHT,
    ROUTE_PACKAGE_MIN_WIDTH,
    ROUTE_PACKAGE_PADDING,
} from './types'

/** Hard cap so bad saved coordinates cannot blow up the canvas. */
const ROUTE_MAX_PACKAGE_DIMENSION = 3200
const ROUTE_MAX_CHILD_OFFSET = 2400

type PackageResizeInteraction = 'drag' | 'settle'

type ResizeRoutePackagesOptions = {
    interaction?: PackageResizeInteraction
    draggedChildId?: string
    dragPosition?: { x: number; y: number }
}

function sortNodesByTitle<T extends Record<string, unknown>>(
    nodeList: Node<T>[],
): Node<T>[] {
    return nodeList.slice().sort((a, b) => {
        const titleA = String((a.data as { task?: { title?: string } }).task?.title ?? a.id)
        const titleB = String((b.data as { task?: { title?: string } }).task?.title ?? b.id)
        return titleA.localeCompare(titleB)
    })
}

export function applyTaskNodeDimensions(node: Node, width: number, height: number) {
    node.width = width
    node.height = height
    node.initialWidth = width
    node.initialHeight = height
    node.style = `width: ${width}px; height: ${height}px;`
}

function applyPackageNodeDimensions(node: Node, width: number, height: number) {
    node.width = width
    node.height = height
    node.initialWidth = width
    node.initialHeight = height
    node.style = `width: ${width}px; height: ${height}px;`
}

function getTaskFromNode(node: Node): TaskRecord | null {
    const task = (node.data as { task?: TaskRecord }).task
    return task ?? null
}

export function isTaskRoutePositionManual(task: TaskRecord | null | undefined): boolean {
    return task?.route_pos_manual === 1
}

function isManualNode(node: Node): boolean {
    return isTaskRoutePositionManual(getTaskFromNode(node))
}

function getLeafNodeSize(node: Node): { width: number; height: number } {
    const task = getTaskFromNode(node)
    const estimate = task ? estimateRouteTaskNodeSize(task) : { width: ROUTE_NODE_WIDTH, height: 56 }
    return {
        width: node.width ?? estimate.width,
        height: node.height ?? estimate.height,
    }
}

function getNodeSize(node: Node): { width: number; height: number } {
    if (node.type === 'routePackage') {
        return {
            width: node.width ?? ROUTE_PACKAGE_MIN_WIDTH,
            height: node.height ?? ROUTE_PACKAGE_MIN_HEIGHT,
        }
    }

    return getLeafNodeSize(node)
}

function applyNodeDimensions(node: Node) {
    const size = getNodeSize(node)
    if (node.type === 'routePackage') {
        applyPackageNodeDimensions(node, size.width, size.height)
    } else {
        applyTaskNodeDimensions(node, size.width, size.height)
    }
}

function seedManualNodePosition(node: Node) {
    const task = getTaskFromNode(node)
    if (!isTaskRoutePositionManual(task)) return

    node.position = {
        x: sanitizeCoord(task?.route_pos_x ?? node.position.x, ROUTE_PACKAGE_PADDING),
        y: sanitizeCoord(task?.route_pos_y ?? node.position.y, ROUTE_PACKAGE_CONTENT_TOP),
    }
}

function sanitizeCoord(value: number, fallback: number): number {
    if (!Number.isFinite(value)) return fallback
    if (Math.abs(value) > ROUTE_MAX_CHILD_OFFSET) return fallback
    return value
}

function childPositionForMeasure(
    child: Node,
    draggedChildId?: string,
    dragPosition?: { x: number; y: number },
): { x: number; y: number } {
    if (child.id === draggedChildId && dragPosition) {
        return dragPosition
    }

    return child.position
}

function measureChildExtents(
    children: Node[],
    draggedChildId?: string,
    dragPosition?: { x: number; y: number },
): { minX: number; minY: number; maxRight: number; maxBottom: number } {
    let minX = Infinity
    let minY = Infinity
    let maxRight = -Infinity
    let maxBottom = -Infinity

    for (const child of children) {
        const pos = childPositionForMeasure(child, draggedChildId, dragPosition)
        const size = getNodeSize(child)
        const x = sanitizeCoord(pos.x, ROUTE_PACKAGE_PADDING)
        const y = sanitizeCoord(pos.y, ROUTE_PACKAGE_CONTENT_TOP)

        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxRight = Math.max(maxRight, x + size.width)
        maxBottom = Math.max(maxBottom, y + size.height)
    }

    return { minX, minY, maxRight, maxBottom }
}

function cloneNodeLayout(node: Node): Node {
    return {
        ...node,
        position: { ...node.position },
    }
}

type PackageDragPreview = {
    width: number
    height: number
    packagePosition: { x: number; y: number }
    siblingPositions: Array<{ id: string; x: number; y: number }>
}

/** Same layout as settle on a virtual clone; safe to apply package + sibling updates during drag. */
function computePackageDragPreview(
    packageNode: Node,
    children: Node[],
    draggedChildId?: string,
    dragPosition?: { x: number; y: number },
): PackageDragPreview {
    const virtualPackage = cloneNodeLayout(packageNode)
    const virtualChildren = children.map((child) => cloneNodeLayout(child))

    if (draggedChildId && dragPosition) {
        const draggedChild = virtualChildren.find((child) => child.id === draggedChildId)
        if (draggedChild) {
            draggedChild.position = { ...dragPosition }
        }
    }

    reconcilePackageContentLayout(
        virtualPackage,
        virtualChildren,
        draggedChildId,
        dragPosition,
    )

    const measured = measurePackageDimensionsAfterReconcile(virtualChildren)

    return {
        width: measured.width,
        height: measured.height,
        packagePosition: { ...virtualPackage.position },
        siblingPositions: virtualChildren
            .filter((child) => child.id !== draggedChildId)
            .map((child) => ({
                id: child.id,
                x: child.position.x,
                y: child.position.y,
            })),
    }
}

function measurePackageDimensionsAfterReconcile(children: Node[]): { width: number; height: number } {
    if (children.length === 0) {
        return { width: ROUTE_PACKAGE_MIN_WIDTH, height: ROUTE_PACKAGE_MIN_HEIGHT }
    }

    const { maxRight, maxBottom } = measureChildExtents(children)

    const width = Math.max(
        ROUTE_PACKAGE_MIN_WIDTH,
        Math.min(
            ROUTE_MAX_PACKAGE_DIMENSION,
            maxRight + ROUTE_PACKAGE_PADDING + ROUTE_PACKAGE_LAYOUT_BUFFER,
        ),
    )
    const height = Math.max(
        ROUTE_PACKAGE_MIN_HEIGHT,
        Math.min(
            ROUTE_MAX_PACKAGE_DIMENSION,
            maxBottom + ROUTE_PACKAGE_BOTTOM_PADDING + ROUTE_PACKAGE_LAYOUT_BUFFER,
        ),
    )

    return { width, height }
}

/** Normalize content to the padding inset; shift the package opposite to keep canvas positions fixed. */
function reconcilePackageContentLayout(
    packageNode: Node,
    children: Node[],
    draggedChildId?: string,
    dragPosition?: { x: number; y: number },
): Array<{ id: string; x: number; y: number }> {
    const { minX, minY } = measureChildExtents(children, draggedChildId, dragPosition)
    const shiftX = ROUTE_PACKAGE_PADDING - minX
    const shiftY = ROUTE_PACKAGE_CONTENT_TOP - minY

    if (shiftX === 0 && shiftY === 0) return []

    const updates: Array<{ id: string; x: number; y: number }> = []

    for (const child of children) {
        const base = childPositionForMeasure(child, draggedChildId, dragPosition)
        child.position = {
            x: base.x + shiftX,
            y: base.y + shiftY,
        }
        updates.push({
            id: child.id,
            x: child.position.x,
            y: child.position.y,
        })
    }

    packageNode.position = {
        x: packageNode.position.x - shiftX,
        y: packageNode.position.y - shiftY,
    }
    updates.push({
        id: packageNode.id,
        x: packageNode.position.x,
        y: packageNode.position.y,
    })

    return updates
}

function resizePackageFromChildren(
    packageId: string,
    nodesById: Map<string, Node>,
    childrenByParent: Map<string, Node[]>,
    options: ResizeRoutePackagesOptions = {},
): { width: number; height: number; positionUpdates: Array<{ id: string; x: number; y: number }> } {
    const children = childrenByParent.get(packageId) ?? []
    const packageNode = nodesById.get(packageId)
    let positionUpdates: Array<{ id: string; x: number; y: number }> = []

    if (children.length === 0) {
        const width = ROUTE_PACKAGE_MIN_WIDTH
        const height = ROUTE_PACKAGE_MIN_HEIGHT
        if (packageNode) {
            applyPackageNodeDimensions(packageNode, width, height)
            packageNode.zIndex = 0
            packageNode.class = 'route-package-group'
        }
        return { width, height, positionUpdates }
    }

    if (!packageNode) {
        return { width: ROUTE_PACKAGE_MIN_WIDTH, height: ROUTE_PACKAGE_MIN_HEIGHT, positionUpdates }
    }

    if (options.interaction === 'drag') {
        const preview = computePackageDragPreview(
            packageNode,
            children,
            options.draggedChildId,
            options.dragPosition,
        )

        packageNode.position = preview.packagePosition
        applyPackageNodeDimensions(packageNode, preview.width, preview.height)
        packageNode.zIndex = 0
        packageNode.class = 'route-package-group'

        for (const update of preview.siblingPositions) {
            const sibling = children.find((child) => child.id === update.id)
            if (!sibling) continue
            sibling.position = { x: update.x, y: update.y }
        }

        for (const child of children) {
            child.zIndex = 1
        }

        return { width: preview.width, height: preview.height, positionUpdates }
    }

    if (options.draggedChildId && options.dragPosition) {
        const draggedChild = children.find((child) => child.id === options.draggedChildId)
        if (draggedChild) {
            draggedChild.position = { ...options.dragPosition }
        }
    }

    positionUpdates = reconcilePackageContentLayout(
        packageNode,
        children,
        options.draggedChildId,
        options.dragPosition,
    )

    const measured = measurePackageDimensionsAfterReconcile(children)

    applyPackageNodeDimensions(packageNode, measured.width, measured.height)
    packageNode.zIndex = 0
    packageNode.class = 'route-package-group'

    for (const child of children) {
        child.zIndex = 1
    }

    return { width: measured.width, height: measured.height, positionUpdates }
}

function layoutPackageContents(
    packageId: string,
    nodesById: Map<string, Node>,
    childrenByParent: Map<string, Node[]>,
): { width: number; height: number } {
    const children = sortNodesByTitle(childrenByParent.get(packageId) ?? [])

    for (const child of children) {
        if (child.type === 'routePackage') {
            layoutPackageContents(child.id, nodesById, childrenByParent)
        }
    }

    const manualChildren = children.filter((child) => isManualNode(child))
    const autoChildren = children.filter((child) => !isManualNode(child))

    for (const child of manualChildren) {
        seedManualNodePosition(child)
        applyNodeDimensions(child)
    }

    let y = ROUTE_PACKAGE_CONTENT_TOP

    for (const child of autoChildren) {
        const childSize = getNodeSize(child)
        const x = ROUTE_PACKAGE_PADDING

        child.position = { x, y }
        applyNodeDimensions(child)
        child.zIndex = 1

        y += childSize.height + ROUTE_CHILD_GAP
    }

    const { width, height } = resizePackageFromChildren(packageId, nodesById, childrenByParent, {
        interaction: 'settle',
    })
    return { width, height }
}

function findLayoutRoot(nodeId: string, nodesById: Map<string, Node>): string {
    let currentId = nodeId

    while (true) {
        const node = nodesById.get(currentId)
        if (!node?.parentId) return currentId
        currentId = node.parentId
    }
}

function collapseEdgesForRoots(edges: Edge[], nodesById: Map<string, Node>): Edge[] {
    const seen = new Set<string>()
    const collapsed: Edge[] = []

    for (const edge of edges) {
        const source = findLayoutRoot(edge.source, nodesById)
        const target = findLayoutRoot(edge.target, nodesById)
        if (source === target) continue

        const key = `${source}->${target}`
        if (seen.has(key)) continue
        seen.add(key)

        collapsed.push({
            ...edge,
            id: `layout:${key}`,
            source,
            target,
        })
    }

    return collapsed
}

function getNodeDepth(nodeId: string, nodesById: Map<string, Node>): number {
    let depth = 0
    let current = nodesById.get(nodeId)

    while (current?.parentId) {
        depth += 1
        current = nodesById.get(current.parentId)
    }

    return depth
}

function collectPackageIdsForNode(
    nodesById: Map<string, Node>,
    changedNodeId?: string,
): Set<string> {
    const packageIds = new Set<string>()
    let currentId = changedNodeId

    while (currentId) {
        const node = nodesById.get(currentId)
        if (!node) break
        if (node.parentId) {
            packageIds.add(node.parentId)
            currentId = node.parentId
            continue
        }
        if (node.type === 'routePackage') {
            packageIds.add(node.id)
        }
        break
    }

    return packageIds
}

/** Recompute package sizes from current child positions (e.g. while dragging). */
export function resizeRoutePackagesFromChildren<T extends Record<string, unknown>>(
    nodes: Node<T>[],
    changedNodeId?: string,
    options: ResizeRoutePackagesOptions = {},
): {
    nodes: Node<T>[]
    positionUpdates: Array<{ id: string; x: number; y: number }>
} {
    if (nodes.length === 0) {
        return { nodes, positionUpdates: [] }
    }

    const nodesById = new Map<string, Node<T>>(nodes.map((node) => [node.id, node]))
    const childrenByParent = new Map<string, Node<T>[]>()
    const positionUpdates: Array<{ id: string; x: number; y: number }> = []

    for (const node of nodes) {
        if (!node.parentId) continue
        const siblings = childrenByParent.get(node.parentId) ?? []
        siblings.push(node)
        childrenByParent.set(node.parentId, siblings)
    }

    const packageIds = collectPackageIdsForNode(nodesById, changedNodeId)
    const packageNodes = [...packageIds]
        .map((id) => nodesById.get(id))
        .filter((node): node is Node<T> => node != null)
        .sort((a, b) => getNodeDepth(b.id, nodesById) - getNodeDepth(a.id, nodesById))

    for (const packageNode of packageNodes) {
        const result = resizePackageFromChildren(
            packageNode.id,
            nodesById as Map<string, Node>,
            childrenByParent as Map<string, Node[]>,
            {
                ...options,
                draggedChildId: options.draggedChildId ?? changedNodeId,
            },
        )
        positionUpdates.push(...result.positionUpdates)
    }

    if (options.interaction === 'drag') {
        const draggedId = options.draggedChildId ?? changedNodeId
        const updatedIds = new Set<string>()

        for (const packageNode of packageNodes) {
            updatedIds.add(packageNode.id)
            for (const child of childrenByParent.get(packageNode.id) ?? []) {
                if (child.id !== draggedId) {
                    updatedIds.add(child.id)
                }
            }
        }

        return {
            nodes: nodes.map((node) => {
                if (node.id === draggedId || !updatedIds.has(node.id)) return node
                return { ...(nodesById.get(node.id) ?? node) }
            }),
            positionUpdates: [],
        }
    }

    const updatedIds = new Set<string>([...packageIds])
    for (const update of positionUpdates) {
        updatedIds.add(update.id)
    }
    if (changedNodeId) updatedIds.add(changedNodeId)

    return {
        nodes: nodes.map((node) => {
            if (!updatedIds.has(node.id)) return node
            return { ...(nodesById.get(node.id) ?? node) }
        }),
        positionUpdates,
    }
}

export function layoutRouteGraph<T extends Record<string, unknown>>(
    nodes: Node<T>[],
    edges: Edge[],
    rankdir: 'TB' | 'LR' = 'TB',
): Node<T>[] {
    if (nodes.length === 0) return nodes

    const nodesById = new Map<string, Node<T>>(nodes.map((node) => [node.id, node]))
    const childrenByParent = new Map<string, Node<T>[]>()

    for (const node of nodes) {
        if (!node.parentId) continue
        const siblings = childrenByParent.get(node.parentId) ?? []
        siblings.push(node)
        childrenByParent.set(node.parentId, siblings)
    }

    const packageNodes = nodes
        .filter((node) => node.type === 'routePackage')
        .sort((a, b) => getNodeDepth(b.id, nodesById) - getNodeDepth(a.id, nodesById))

    for (const packageNode of packageNodes) {
        layoutPackageContents(
            packageNode.id,
            nodesById as Map<string, Node>,
            childrenByParent as Map<string, Node[]>,
        )
    }

    const roots = nodes.filter((node) => !node.parentId)
    if (roots.length === 0) return nodes

    const manualRoots = roots.filter((node) => isManualNode(node))
    const autoRoots = roots.filter((node) => !isManualNode(node))

    for (const node of manualRoots) {
        seedManualNodePosition(node)
        applyNodeDimensions(node)
    }

    if (autoRoots.length > 0) {
        const graph = new dagre.graphlib.Graph()
        graph.setDefaultEdgeLabel(() => ({}))
        graph.setGraph({
            rankdir,
            nodesep: 56,
            ranksep: 88,
            marginx: 32,
            marginy: 32,
        })

        for (const node of autoRoots) {
            const size = getNodeSize(node)
            graph.setNode(node.id, size)
            applyNodeDimensions(node)
        }

        for (const edge of collapseEdgesForRoots(edges, nodesById as Map<string, Node>)) {
            if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) continue
            graph.setEdge(edge.source, edge.target)
        }

        dagre.layout(graph)

        for (const node of autoRoots) {
            const positioned = graph.node(node.id)
            const size = getNodeSize(node)

            node.position = {
                x: positioned.x - size.width / 2,
                y: positioned.y - size.height / 2,
            }
        }
    }

    return nodes
}
