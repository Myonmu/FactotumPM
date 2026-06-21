export function bindPopoverDismiss(
    getPopoverEl: () => HTMLElement | null,
    onClose: () => void,
    extraCleanup?: () => void,
): () => void {
    let focusOutTimer: ReturnType<typeof setTimeout> | undefined
    let boundEl: HTMLElement | null = null

    function scheduleFocusCheck() {
        clearTimeout(focusOutTimer)
        focusOutTimer = setTimeout(() => {
            const popoverEl = getPopoverEl()
            if (!popoverEl) return

            const active = document.activeElement
            if (active instanceof Node && popoverEl.contains(active)) return

            onClose()
        }, 0)
    }

    function handlePointerDown(event: PointerEvent) {
        const popoverEl = getPopoverEl()
        if (!popoverEl) return
        if (popoverEl.contains(event.target as Node)) return
        onClose()
    }

    function handleFocusIn(event: FocusEvent) {
        const popoverEl = getPopoverEl()
        const target = event.target as Node | null
        if (!popoverEl) return
        if (target && popoverEl.contains(target)) return
        onClose()
    }

    function handleFocusOut(event: FocusEvent) {
        const popoverEl = getPopoverEl()
        if (!popoverEl) return
        if (!popoverEl.contains(event.target as Node)) return

        const related = event.relatedTarget as Node | null
        if (related && popoverEl.contains(related)) return

        scheduleFocusCheck()
    }

    function handleKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            event.preventDefault()
            onClose()
        }
    }

    function attachToPopover() {
        detachFromPopover()
        boundEl = getPopoverEl()
        boundEl?.addEventListener('focusout', handleFocusOut)
    }

    function detachFromPopover() {
        boundEl?.removeEventListener('focusout', handleFocusOut)
        boundEl = null
    }

    attachToPopover()
    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('focusin', handleFocusIn, true)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
        clearTimeout(focusOutTimer)
        detachFromPopover()
        window.removeEventListener('pointerdown', handlePointerDown, true)
        window.removeEventListener('focusin', handleFocusIn, true)
        window.removeEventListener('keydown', handleKeyDown)
        extraCleanup?.()
    }
}
