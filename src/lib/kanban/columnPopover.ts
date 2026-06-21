export function getPageBounds(): DOMRect {
    const margin = 8
    const main = document.querySelector('main')
    if (main) {
        return main.getBoundingClientRect()
    }

    return new DOMRect(margin, margin, window.innerWidth - margin * 2, window.innerHeight - margin * 2)
}

export function getScrollParents(element: HTMLElement | null): HTMLElement[] {
    const parents: HTMLElement[] = []
    let current = element?.parentElement ?? null

    while (current) {
        const style = getComputedStyle(current)
        const overflow = `${style.overflow} ${style.overflowX} ${style.overflowY}`
        if (/(auto|scroll|overlay)/.test(overflow)) {
            parents.push(current)
        }
        current = current.parentElement
    }

    return parents
}

/** Horizontal clamp for an absolutely positioned popover below its trigger. */
export function computePopoverShift(
    panelEl: HTMLElement,
    options: { margin?: number } = {},
): string {
    const margin = options.margin ?? 8
    const page = getPageBounds()
    const panelRect = panelEl.getBoundingClientRect()
    let shiftX = 0

    if (panelRect.right > page.right - margin) {
        shiftX -= panelRect.right - (page.right - margin)
    }

    if (panelRect.left + shiftX < page.left + margin) {
        shiftX += page.left + margin - (panelRect.left + shiftX)
    }

    return shiftX !== 0 ? `transform: translateX(${shiftX}px);` : ''
}
