<script lang="ts">
    import { tick } from 'svelte'

    import { computeRefCardPreviewStyle } from '$lib/components/refCardHover'

    let {
        children,
        disabled = false,
        anchorClass = '',
    }: {
        children: import('svelte').Snippet<[expanded: boolean]>
        disabled?: boolean
        anchorClass?: string
    } = $props()

    let anchorEl = $state<HTMLElement | null>(null)
    let previewEl = $state<HTMLElement | null>(null)
    let visible = $state(false)
    let previewStyle = $state('')
    let showTimer: ReturnType<typeof setTimeout> | undefined
    let hideTimer: ReturnType<typeof setTimeout> | undefined

    async function updatePosition() {
        await tick()
        if (!anchorEl || !previewEl || !visible) return
        previewStyle = computeRefCardPreviewStyle(anchorEl, previewEl)

        requestAnimationFrame(() => {
            if (!anchorEl || !previewEl || !visible) return
            previewStyle = computeRefCardPreviewStyle(anchorEl, previewEl)
        })
    }

    function onEnter() {
        if (disabled) return
        clearTimeout(hideTimer)
        showTimer = setTimeout(() => {
            visible = true
            void updatePosition()
        }, 150)
    }

    function onLeave() {
        clearTimeout(showTimer)
        hideTimer = setTimeout(() => {
            visible = false
        }, 80)
    }

    function onPreviewEnter() {
        clearTimeout(hideTimer)
    }

    $effect(() => {
        if (visible && previewEl) {
            void updatePosition()
        }
    })

    $effect(() => {
        if (!visible) return

        const onScrollOrResize = () => {
            void updatePosition()
        }

        window.addEventListener('scroll', onScrollOrResize, true)
        window.addEventListener('resize', onScrollOrResize)

        return () => {
            window.removeEventListener('scroll', onScrollOrResize, true)
            window.removeEventListener('resize', onScrollOrResize)
        }
    })
</script>

<div
        bind:this={anchorEl}
        class="ref-card-hover-anchor min-w-0 max-w-full {anchorClass}"
        role="presentation"
        onmouseenter={onEnter}
        onmouseleave={onLeave}
>
    {@render children(false)}
</div>

{#if visible}
    <div
            bind:this={previewEl}
            class="ref-card-hover-preview fixed z-[200] overflow-y-auto overflow-x-hidden"
            style={previewStyle}
            onmouseenter={onPreviewEnter}
            onmouseleave={onLeave}
            role="tooltip"
    >
        {@render children(true)}
    </div>
{/if}
