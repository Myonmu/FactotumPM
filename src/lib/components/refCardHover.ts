import { getPageBounds } from '$lib/kanban/columnPopover'

export const REF_CARD_EXPANDED_CLASSES =
    'w-max max-w-[min(28rem,calc(100vw-1rem))] shadow-lg !border !border-base-300 !bg-base-100 !px-2 !py-1'

export function refCardRootClass(base: string, className: string, expanded: boolean): string {
    if (expanded) {
        return `${base} ${REF_CARD_EXPANDED_CLASSES}`
    }

    return `${base} ${className}`.trim()
}

export function computeRefCardPreviewStyle(
    anchor: HTMLElement,
    preview: HTMLElement,
    options: { margin?: number; gap?: number } = {},
): string {
    const margin = options.margin ?? 8
    const gap = options.gap ?? 4
    const page = getPageBounds()
    const anchorRect = anchor.getBoundingClientRect()
    const previewRect = preview.getBoundingClientRect()

    const maxWidth = Math.max(120, page.width - margin * 2)
    const previewWidth = Math.min(previewRect.width, maxWidth)
    const previewHeight = previewRect.height

    let left = anchorRect.left
    let top = anchorRect.bottom + gap

    if (left + previewWidth > page.right - margin) {
        left = page.right - margin - previewWidth
    }

    if (left < page.left + margin) {
        left = page.left + margin
    }

    if (top + previewHeight > page.bottom - margin) {
        top = anchorRect.top - previewHeight - gap
    }

    if (top < page.top + margin) {
        top = page.top + margin
    }

    const maxHeight = Math.max(48, page.bottom - margin - top)

    return [
        `top:${Math.round(top)}px`,
        `left:${Math.round(left)}px`,
        `max-width:${Math.round(maxWidth)}px`,
        `max-height:${Math.round(maxHeight)}px`,
    ].join(';')
}
