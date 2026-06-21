<script lang="ts">
    import Fuse from 'fuse.js'
    import { tick } from 'svelte'

    import LucideIcon from '$lib/components/LucideIcon.svelte'
    import {
        lucideIconRegistry,
        type LucideIconEntry,
    } from '$lib/icons/lucideIconRegistry'
    import { bindPopoverDismiss } from '$lib/grid/popoverDismiss'

    type Anchor = {
        top: number
        left: number
        width: number
        height: number
    }

    let {
        anchor,
        value = null,
        iconColor = null,
        onSelect,
        onClose,
    }: {
        anchor: Anchor
        value?: string | null
        iconColor?: number | null
        onSelect?: (iconId: string | null) => void | Promise<void>
        onClose?: () => void
    } = $props()

    let query = $state('')
    let popoverEl = $state<HTMLElement | null>(null)
    let searchInputEl = $state<HTMLInputElement | null>(null)

    let fuse = $derived(
        new Fuse(lucideIconRegistry, {
            keys: ['id', 'label'],
            threshold: 0.35,
        }),
    )

    let filteredIcons = $derived.by((): LucideIconEntry[] => {
        const trimmed = query.trim()
        if (!trimmed) return lucideIconRegistry
        return fuse.search(trimmed).map((result) => result.item)
    })

    let popoverStyle = $derived.by(() => {
        const width = 320
        const height = 360
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

    async function selectIcon(iconId: string | null) {
        await onSelect?.(iconId)
        onClose?.()
    }

    $effect(() => {
        if (!popoverEl) return

        const unbindDismiss = bindPopoverDismiss(() => popoverEl, () => onClose?.())

        void tick().then(() => {
            searchInputEl?.focus({ preventScroll: true })
        })

        return unbindDismiss
    })
</script>

<div
        bind:this={popoverEl}
        class="icon-picker-popover fixed z-50 flex flex-col rounded-box border border-base-300 bg-base-100 p-3 shadow-xl"
        style={popoverStyle}
        role="dialog"
        aria-modal="true"
        aria-label="Choose icon"
        tabindex="-1"
>
    <div class="mb-2 flex items-center gap-2">
        <input
                bind:this={searchInputEl}
                type="search"
                class="input input-sm input-bordered w-full"
                placeholder="Search Lucide icons…"
                bind:value={query}
        />
        <button
                type="button"
                class="btn btn-ghost btn-sm shrink-0"
                onclick={() => selectIcon(null)}
                title="Clear icon"
        >
            Clear
        </button>
    </div>

    {#if value}
        <div class="mb-2 flex items-center gap-2 rounded-btn bg-base-200 px-2 py-1 text-sm">
            <span class="text-base-content/60">Selected:</span>
            <LucideIcon name={value} size={16} color={iconColor} />
            <span class="truncate">{value}</span>
        </div>
    {/if}

    <div class="min-h-0 flex-1 overflow-y-auto">
        <div class="grid grid-cols-6 gap-1">
            {#each filteredIcons as icon (icon.id)}
                {@const Icon = icon.component}
                <button
                        type="button"
                        class="btn btn-ghost btn-square btn-sm {value === icon.id ? 'btn-active' : ''}"
                        title={icon.label}
                        aria-label={icon.label}
                        onclick={() => selectIcon(icon.id)}
                >
                    <Icon size={16} />
                </button>
            {/each}
        </div>

        {#if filteredIcons.length === 0}
            <p class="py-6 text-center text-sm text-base-content/60">No icons match your search.</p>
        {/if}
    </div>
</div>

<style>
    .icon-picker-popover {
        max-height: min(360px, calc(100vh - 1rem));
    }
</style>
