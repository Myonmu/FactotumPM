let dragging = $state(false)

export function isRouteGraphDragging() {
    return dragging
}

export function setRouteGraphDragging(value: boolean) {
    dragging = value
}
