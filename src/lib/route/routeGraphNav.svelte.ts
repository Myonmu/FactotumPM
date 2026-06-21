import type { RouteGraphView } from './types'

const FULL_GRAPH_VIEW: RouteGraphView = {
    filterTaskIds: null,
    anchorTaskId: null,
}

let currentView = $state<RouteGraphView>(FULL_GRAPH_VIEW)
let backStack = $state<RouteGraphView[]>([])
let forwardStack = $state<RouteGraphView[]>([])

function viewsEqual(a: RouteGraphView, b: RouteGraphView): boolean {
    if (a.anchorTaskId !== b.anchorTaskId) return false
    if (a.filterTaskIds === null && b.filterTaskIds === null) return true
    if (a.filterTaskIds === null || b.filterTaskIds === null) return false
    if (a.filterTaskIds.length !== b.filterTaskIds.length) return false

    const sortedA = [...a.filterTaskIds].sort()
    const sortedB = [...b.filterTaskIds].sort()
    return sortedA.every((value, index) => value === sortedB[index])
}

export function getRouteGraphView() {
    return currentView
}

export function getRouteGraphNav() {
    return {
        canGoBack: backStack.length > 0,
        canGoForward: forwardStack.length > 0,
        isFiltered: currentView.filterTaskIds != null,
        anchorTaskId: currentView.anchorTaskId,
    }
}

export function resetRouteGraphNav() {
    currentView = FULL_GRAPH_VIEW
    backStack = []
    forwardStack = []
}

export function pushRouteGraphView(nextView: RouteGraphView) {
    if (viewsEqual(currentView, nextView)) return

    backStack = [...backStack, currentView]
    forwardStack = []
    currentView = nextView
}

export function navigateRouteGraphBack() {
    if (backStack.length === 0) return

    const previous = backStack[backStack.length - 1]
    backStack = backStack.slice(0, -1)
    forwardStack = [...forwardStack, currentView]
    currentView = previous
}

export function navigateRouteGraphForward() {
    if (forwardStack.length === 0) return

    const next = forwardStack[forwardStack.length - 1]
    forwardStack = forwardStack.slice(0, -1)
    backStack = [...backStack, currentView]
    currentView = next
}
