import dagre from '@dagrejs/dagre'

import type { TaskDependencyEdge, TaskRecord } from '$lib/db/dataView'

export type TrophyEdge = {
    id: string
    source: string
    target: string
}

/**
 * Map every task to its owning trophy: the nearest ancestor (including itself)
 * whose task is flagged as a trophy. Tasks with no trophy ancestor are unowned.
 */
function buildTrophyOwnership(tasks: TaskRecord[]): Map<string, string> {
    const byId = new Map(tasks.map((task) => [task.id, task]))
    const ownerCache = new Map<string, string | null>()

    function resolveOwner(taskId: string, seen: Set<string>): string | null {
        if (ownerCache.has(taskId)) return ownerCache.get(taskId) ?? null
        if (seen.has(taskId)) return null
        seen.add(taskId)

        const task = byId.get(taskId)
        if (!task) return null

        let owner: string | null
        if (Number(task.is_trophy) === 1) {
            owner = task.id
        } else if (task.parent_task_id) {
            owner = resolveOwner(task.parent_task_id, seen)
        } else {
            owner = null
        }

        ownerCache.set(taskId, owner)
        return owner
    }

    const result = new Map<string, string>()
    for (const task of tasks) {
        const owner = resolveOwner(task.id, new Set())
        if (owner) result.set(task.id, owner)
    }
    return result
}

/** Nearest strict trophy ancestor of a trophy task (the trophy it rolls up into). */
function nearestAncestorTrophy(task: TaskRecord, byId: Map<string, TaskRecord>): string | null {
    let currentId = task.parent_task_id
    const seen = new Set<string>([task.id])
    while (currentId && !seen.has(currentId)) {
        seen.add(currentId)
        const current = byId.get(currentId)
        if (!current) break
        if (Number(current.is_trophy) === 1) return current.id
        currentId = current.parent_task_id
    }
    return null
}

/**
 * Collapse the task dependency graph (plus trophy containment) down to trophy
 * nodes. An edge A -> B means trophy A depends on trophy B.
 */
export function buildTrophyDependencyEdges(
    tasks: TaskRecord[],
    dependencies: TaskDependencyEdge[],
): TrophyEdge[] {
    const byId = new Map(tasks.map((task) => [task.id, task]))
    const ownership = buildTrophyOwnership(tasks)
    const seen = new Set<string>()
    const edges: TrophyEdge[] = []

    function addEdge(source: string, target: string) {
        if (source === target) return
        const key = `${source}->${target}`
        if (seen.has(key)) return
        // Never create a back-edge: if A -> B already exists, do not also add
        // B -> A (that would render as a mutual/bidirectional dependency).
        if (seen.has(`${target}->${source}`)) return
        seen.add(key)
        edges.push({ id: `trophy:${key}`, source, target })
    }

    // Explicit task dependencies take precedence over containment, so add them
    // first. A dependency from_task -> to_task means "from depends on to".
    for (const dependency of dependencies) {
        const source = ownership.get(dependency.from_task_id)
        const target = ownership.get(dependency.to_task_id)
        if (source && target) addEdge(source, target)
    }

    // Containment: a parent trophy is only obtained once its child trophies are,
    // so the parent depends on the child (ancestor -> child).
    for (const task of tasks) {
        if (Number(task.is_trophy) !== 1) continue
        const ancestor = nearestAncestorTrophy(task, byId)
        if (ancestor) addEdge(ancestor, task.id)
    }

    return edges
}

/** Position trophy nodes top-to-bottom with dagre. */
export function layoutTrophyNodes(
    nodeIds: string[],
    edges: TrophyEdge[],
    nodeWidth: number,
    nodeHeight: number,
): Map<string, { x: number; y: number }> {
    const graph = new dagre.graphlib.Graph()
    graph.setDefaultEdgeLabel(() => ({}))
    graph.setGraph({ rankdir: 'TB', nodesep: 48, ranksep: 80, marginx: 24, marginy: 24 })

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
        if (!node) {
            positions.set(id, { x: 0, y: 0 })
            continue
        }
        positions.set(id, { x: node.x - nodeWidth / 2, y: node.y - nodeHeight / 2 })
    }
    return positions
}
