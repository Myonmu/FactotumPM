export function findStatusIdAtPoint(x: number, y: number): string | null {
    for (const element of document.elementsFromPoint(x, y)) {
        const column = element.closest('[data-status-id]') as HTMLElement | null
        if (column?.dataset.statusId) {
            return column.dataset.statusId
        }
    }

    return null
}
