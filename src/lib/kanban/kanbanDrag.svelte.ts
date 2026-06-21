let dragging = $state(false)

export function isKanbanDragging() {
    return dragging
}

export function setKanbanDragging(value: boolean) {
    dragging = value
}
