import type { TaskDependencyEdge, TaskRecord } from '$lib/db/dataView'

export function buildUndirectedTaskAdjacency(
    tasks: TaskRecord[],
    dependencies: TaskDependencyEdge[],
): Map<string, Set<string>> {
    const adjacency = new Map<string, Set<string>>()

    function link(a: string, b: string) {
        if (a === b) return

        const neighborsA = adjacency.get(a) ?? new Set<string>()
        neighborsA.add(b)
        adjacency.set(a, neighborsA)

        const neighborsB = adjacency.get(b) ?? new Set<string>()
        neighborsB.add(a)
        adjacency.set(b, neighborsB)
    }

    for (const task of tasks) {
        if (task.parent_task_id) {
            link(task.id, task.parent_task_id)
        }
    }

    for (const dependency of dependencies) {
        link(dependency.from_task_id, dependency.to_task_id)
    }

    return adjacency
}

export function collectConnectedTaskIds(
    taskId: string,
    adjacency: Map<string, Set<string>>,
): Set<string> {
    const visited = new Set<string>()
    const queue = [taskId]

    while (queue.length > 0) {
        const current = queue.shift()
        if (!current || visited.has(current)) continue

        visited.add(current)

        for (const neighbor of adjacency.get(current) ?? []) {
            if (!visited.has(neighbor)) {
                queue.push(neighbor)
            }
        }
    }

    return visited
}
