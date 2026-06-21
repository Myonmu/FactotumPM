import { getInspectedTaskId } from '$lib/inspector.svelte'

export type TaskInspectorResolver = (taskId: string) => void | Promise<void>

let resolver = $state<TaskInspectorResolver | null>(null)
let backStack = $state<string[]>([])
let forwardStack = $state<string[]>([])

export function getTaskInspectorNav() {
    return {
        enabled: resolver != null,
        canGoBack: backStack.length > 0,
        canGoForward: forwardStack.length > 0,
    }
}

export function beginTaskInspectorSession(resolveTask: TaskInspectorResolver) {
    resolver = resolveTask
    backStack = []
    forwardStack = []
}

export function endTaskInspectorSession() {
    resolver = null
    backStack = []
    forwardStack = []
}

export async function navigateToRelatedTask(taskId: string) {
    const currentId = getInspectedTaskId()
    if (!resolver || !currentId || taskId === currentId) return

    backStack = [...backStack, currentId]
    forwardStack = []
    await resolver(taskId)
}

export async function navigateTaskInspectorBack() {
    if (!resolver || backStack.length === 0) return

    const currentId = getInspectedTaskId()
    const previousId = backStack[backStack.length - 1]
    backStack = backStack.slice(0, -1)

    if (currentId) {
        forwardStack = [...forwardStack, currentId]
    }

    await resolver(previousId)
}

export async function navigateTaskInspectorForward() {
    if (!resolver || forwardStack.length === 0) return

    const currentId = getInspectedTaskId()
    const nextId = forwardStack[forwardStack.length - 1]
    forwardStack = forwardStack.slice(0, -1)

    if (currentId) {
        backStack = [...backStack, currentId]
    }

    await resolver(nextId)
}
