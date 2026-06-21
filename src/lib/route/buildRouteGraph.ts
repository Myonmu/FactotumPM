import { MarkerType, Position, type Edge, type Node } from '@xyflow/svelte'

import type { TaskDependencyEdge, TaskRecord } from '$lib/db/dataView'
import type { DomainOption } from '$lib/db/dataView'

import { estimateRouteTaskNodeSize } from './routeTaskNodeSize'
import { isTaskRoutePositionManual } from './layoutRouteGraph'
import { ROUTE_PACKAGE_CONTENT_TOP, ROUTE_PACKAGE_PADDING } from './types'

export type RouteNodeData = {
    task: TaskRecord
    domains: DomainOption[]
    childCount?: number
    dimmed?: boolean
    isConnectionSource?: boolean
    isDropTarget?: boolean
    onCardClick?: (task: TaskRecord) => void
    onMiddleClick?: (task: TaskRecord) => void
    onConnectionDragStart?: (taskId: string, event: PointerEvent) => void
}

/** @deprecated Use RouteNodeData */
export type RouteTaskNodeData = RouteNodeData

type BuildRouteGraphInput = {
    tasks: TaskRecord[]
    dependencies: TaskDependencyEdge[]
    domains: DomainOption[]
    visibleTaskIds: Set<string>
    terminalStatusIds?: Set<string>
    connectionDragSourceId?: string | null
    connectionDropTargetId?: string | null
    onCardClick?: (task: TaskRecord) => void
    onMiddleClick?: (task: TaskRecord) => void
    onConnectionDragStart?: (taskId: string, event: PointerEvent) => void
}

function getVisibleChildCount(taskId: string, visibleTasks: TaskRecord[]): number {
    return visibleTasks.filter((task) => task.parent_task_id === taskId).length
}

function isPackageTask(taskId: string, visibleTasks: TaskRecord[]): boolean {
    return getVisibleChildCount(taskId, visibleTasks) > 0
}

function getVisibleDepth(task: TaskRecord, tasksById: Map<string, TaskRecord>, visibleTaskIds: Set<string>): number {
    let depth = 0
    let parentId = task.parent_task_id

    while (parentId && visibleTaskIds.has(parentId)) {
        depth += 1
        parentId = tasksById.get(parentId)?.parent_task_id ?? null
    }

    return depth
}

function sortVisibleTasksParentFirst(tasks: TaskRecord[], visibleTaskIds: Set<string>): TaskRecord[] {
    const tasksById = new Map(tasks.map((task) => [task.id, task]))

    return tasks
        .filter((task) => visibleTaskIds.has(task.id))
        .slice()
        .sort((a, b) => {
            const depthDiff =
                getVisibleDepth(a, tasksById, visibleTaskIds)
                - getVisibleDepth(b, tasksById, visibleTaskIds)
            if (depthDiff !== 0) return depthDiff
            return a.title.localeCompare(b.title)
        })
}

export function buildRouteGraphElements({
    tasks,
    dependencies,
    domains,
    visibleTaskIds,
    terminalStatusIds = new Set<string>(),
    connectionDragSourceId = null,
    connectionDropTargetId = null,
    onCardClick,
    onMiddleClick,
    onConnectionDragStart,
}: BuildRouteGraphInput): {
    nodes: Node<RouteNodeData>[]
    edges: Edge[]
} {
    const visibleTasks = sortVisibleTasksParentFirst(tasks, visibleTaskIds)
    const nodeData = (task: TaskRecord): RouteNodeData => ({
        task,
        domains,
        childCount: getVisibleChildCount(task.id, visibleTasks),
        dimmed:
            task.task_status_id != null
            && terminalStatusIds.has(task.task_status_id),
        isConnectionSource: task.id === connectionDragSourceId,
        isDropTarget:
            task.id === connectionDropTargetId
            && task.id !== connectionDragSourceId,
        onCardClick,
        onMiddleClick,
        onConnectionDragStart,
    })

    const nodes: Node<RouteNodeData>[] = visibleTasks.map((task) => {
        const isPackage = isPackageTask(task.id, visibleTasks)
        const parentVisible =
            task.parent_task_id != null
            && visibleTaskIds.has(task.parent_task_id)
            && isPackageTask(task.parent_task_id, visibleTasks)

        return {
            id: task.id,
            type: isPackage ? 'routePackage' : 'routeTask',
            origin: [0, 0],
            position:
                isTaskRoutePositionManual(task)
                && task.route_pos_x != null
                && task.route_pos_y != null
                    ? { x: task.route_pos_x, y: task.route_pos_y }
                    : parentVisible
                      ? {
                            x: ROUTE_PACKAGE_PADDING,
                            y: ROUTE_PACKAGE_CONTENT_TOP,
                        }
                      : { x: 0, y: 0 },
            draggable: true,
            selectable: false,
            focusable: false,
            ...(parentVisible
                ? {
                      parentId: task.parent_task_id ?? undefined,
                  }
                : {}),
            sourcePosition: Position.Bottom,
            targetPosition: Position.Top,
            ...(isPackage
                ? {}
                : (() => {
                      const size = estimateRouteTaskNodeSize(task)
                      return {
                          width: size.width,
                          height: size.height,
                          style: `width: ${size.width}px; height: ${size.height}px;`,
                      }
                  })()),
            data: nodeData(task),
        }
    })

    const edges: Edge[] = []

    for (const dependency of dependencies) {
        if (
            !visibleTaskIds.has(dependency.from_task_id)
            || !visibleTaskIds.has(dependency.to_task_id)
        ) {
            continue
        }

        edges.push({
            id: `dependency:${dependency.id}`,
            source: dependency.from_task_id,
            target: dependency.to_task_id,
            type: 'smoothstep',
            data: { kind: 'dependency', dependencyId: dependency.id },
            zIndex: 1,
            interactionWidth: 20,
            class: 'route-dependency-edge',
            style: 'stroke: oklch(var(--p)); stroke-width: 2;',
            markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 18,
                height: 18,
                color: 'oklch(var(--p))',
            },
        })
    }

    return { nodes, edges }
}
