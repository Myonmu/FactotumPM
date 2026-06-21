import type { Component } from 'svelte'

import { endTaskInspectorSession } from '$lib/taskInspectorNav.svelte'

type InspectorState = {
    visible: boolean
    title: string
    inspectedTaskId: string | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: Component<any> | null
    componentProps: Record<string, unknown>
}

let state = $state<InspectorState>({
    visible: false,
    title: 'Inspector',
    inspectedTaskId: null,
    component: null,
    componentProps: {},
})

function extractTaskId(componentProps: Record<string, unknown>): string | null {
    const task = componentProps.task
    if (task && typeof task === 'object' && 'id' in task && typeof task.id === 'string') {
        return task.id
    }

    return null
}

export function getInspectorState() {
    return state
}

export function getInspectedTaskId() {
    return state.inspectedTaskId
}

export function openInspector(
    component: Component<any>,
    componentProps: Record<string, unknown> = {},
    title = 'Inspector',
) {
    state.visible = true
    state.title = title
    state.component = component
    state.componentProps = componentProps
    state.inspectedTaskId = extractTaskId(componentProps)
}

export function closeInspector() {
    state.visible = false
    state.inspectedTaskId = null
    endTaskInspectorSession()
}

export function updateInspectorProps(
    componentProps: Record<string, unknown>,
    title?: string,
) {
    state.componentProps = {
        ...state.componentProps,
        ...componentProps,
    }

    if (title) {
        state.title = title
    }

    if ('task' in componentProps) {
        state.inspectedTaskId = extractTaskId(state.componentProps)
    }
}

export function syncInspectedTask(
    task: { id: string },
    extraProps: Record<string, unknown> = {},
) {
    if (!state.visible || state.inspectedTaskId !== task.id) {
        return
    }

    updateInspectorProps({ task, ...extraProps })
}
