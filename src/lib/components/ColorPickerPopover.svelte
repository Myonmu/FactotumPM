<script lang="ts">
    import { untrack } from 'svelte'

    import OptionalColorInput from '$lib/components/OptionalColorInput.svelte'
    import { bindPopoverDismiss } from '$lib/grid/popoverDismiss'

    type Anchor = {
        top: number
        left: number
        width: number
        height: number
    }

    let {
        anchor,
        initialValue = null,
        optional = false,
        onSelect,
        onClose,
    }: {
        anchor: Anchor
        initialValue?: number | null
        optional?: boolean
        onSelect?: (color: number | null) => void | Promise<void>
        onClose?: () => void
    } = $props()

    let popoverEl = $state<HTMLElement | null>(null)

    const initialColorInt = untrack((): number | null => {
        if (initialValue == null || initialValue === '') return null
        const numeric = Number(initialValue)
        return Number.isNaN(numeric) ? null : numeric
    })

    let selectedColor = $state<number | null>(untrack(() => initialColorInt))

    let popoverStyle = $derived.by(() => {
        const width = 260
        const height = 56
        const margin = 8
        const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : width
        const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : height

        let left = anchor.left
        let top = anchor.top + anchor.height + margin

        if (left + width + margin > viewportWidth) {
            left = Math.max(margin, viewportWidth - width - margin)
        }

        if (top + height + margin > viewportHeight) {
            top = Math.max(margin, anchor.top - height - margin)
        }

        return `left:${left}px;top:${top}px;width:${width}px;`
    })

    async function handleChange(color: number) {
        selectedColor = color
        await onSelect?.(color)
    }

    async function handleClear() {
        if (!optional) return

        selectedColor = null
        await onSelect?.(null)
        onClose?.()
    }

    $effect(() => {
        if (!popoverEl) return

        return bindPopoverDismiss(() => popoverEl, () => onClose?.())
    })
</script>

<div
        bind:this={popoverEl}
        class="color-picker-popover fixed z-50 rounded-box border border-base-300 bg-base-100 p-3 shadow-xl"
        style={popoverStyle}
        role="dialog"
        aria-modal="true"
        aria-label="Choose color"
        tabindex="-1"
>
    <OptionalColorInput
            value={selectedColor}
            {optional}
            autofocus={true}
            onChange={handleChange}
            onClear={handleClear}
    />
</div>
