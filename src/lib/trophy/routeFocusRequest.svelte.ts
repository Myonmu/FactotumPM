import type { RouteGraphView } from '$lib/route/types'

/**
 * Cross-tab channel: the Trophy tab requests that the Route tab focus on a
 * specific subgraph (the tasks needed to obtain a trophy). The Route graph
 * board consumes this request after it mounts and resets its own nav history,
 * pushing the focused view so backward navigation returns to the full graph.
 */
let pendingFocus = $state<RouteGraphView | null>(null)

export function requestRouteFocus(filterTaskIds: string[], anchorTaskId: string | null) {
    pendingFocus = {
        filterTaskIds: [...filterTaskIds],
        anchorTaskId,
    }
}

export function consumeRouteFocusRequest(): RouteGraphView | null {
    const request = pendingFocus
    pendingFocus = null
    return request
}
