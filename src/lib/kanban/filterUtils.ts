import { v4 as uuid } from 'uuid'

import type { FilterCondition, FilterGroup, FilterNode, KanbanFilterRoot } from './filterTypes'
import { getDefaultOperator } from './taskFilterFields'

export function createDefaultFilter(): KanbanFilterRoot {
    return createFilterGroup()
}

export function createFilterGroup(): FilterGroup {
    return {
        id: uuid(),
        type: 'group',
        logic: 'and',
        children: [],
    }
}

export function createFilterCondition(field = 'title'): FilterCondition {
    return {
        id: uuid(),
        type: 'condition',
        field,
        operator: getDefaultOperator(field),
        value: '',
    }
}

export function countFilterConditions(filter: FilterGroup): number {
    return filter.children.reduce((count, child) => {
        if (child.type === 'condition') return count + 1
        return count + countFilterConditions(child)
    }, 0)
}

export function isFilterActive(filter: KanbanFilterRoot): boolean {
    return countFilterConditions(filter) > 0
}

export function cloneFilterNode<T extends FilterNode>(node: T): T {
    if (node.type === 'condition') {
        return { ...node } as T
    }

    return {
        ...node,
        children: node.children.map((child) => cloneFilterNode(child)),
    } as T
}

export function updateFilterTree(
    root: KanbanFilterRoot,
    nodeId: string,
    updater: (node: FilterNode) => FilterNode,
): KanbanFilterRoot {
    function walk(node: FilterNode): FilterNode {
        if (node.id === nodeId) {
            return updater(node)
        }

        if (node.type === 'group') {
            return {
                ...node,
                children: node.children.map((child) => walk(child)),
            }
        }

        return node
    }

    return walk(root) as KanbanFilterRoot
}

export function removeFilterNode(root: KanbanFilterRoot, nodeId: string): KanbanFilterRoot {
    function walk(node: FilterGroup): FilterGroup {
        return {
            ...node,
            children: node.children
                .filter((child) => child.id !== nodeId)
                .map((child) => (child.type === 'group' ? walk(child) : child)),
        }
    }

    return walk(root)
}
