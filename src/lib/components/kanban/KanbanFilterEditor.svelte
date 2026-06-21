<script lang="ts">
    import { Filter, RotateCcw } from 'lucide-svelte'
    import { tick } from 'svelte'

    import FilterGroupEditor from '$lib/components/kanban/FilterGroupEditor.svelte'
    import {
        computePopoverShift,
        getScrollParents,
    } from '$lib/kanban/columnPopover'
    import type { KanbanFilterRoot } from '$lib/kanban/filterTypes'
    import {
        countFilterConditions,
        createDefaultFilter,
        isFilterActive,
    } from '$lib/kanban/filterUtils'

    let {
        filter = createDefaultFilter(),
        onChange,
        onOpenChange,
        disabled = false,
        disabledTitle,
        panelTitle = 'Column filters',
        panelDescription = 'Combine conditions with AND/OR. Nested groups are supported.',
    }: {
        filter?: KanbanFilterRoot
        onChange?: (nextFilter: KanbanFilterRoot) => void
        onOpenChange?: (open: boolean) => void
        disabled?: boolean
        disabledTitle?: string
        panelTitle?: string
        panelDescription?: string
    } = $props()

    let open = $state(false)
    let rootEl = $state<HTMLDivElement | null>(null)
    let panelEl = $state<HTMLDivElement | null>(null)
    let panelStyle = $state('')

    const activeCount = $derived(countFilterConditions(filter))
    const isActive = $derived(isFilterActive(filter))

    function setOpen(nextOpen: boolean) {
        open = nextOpen
        onOpenChange?.(nextOpen)
    }

    function emitChange(nextFilter: KanbanFilterRoot) {
        onChange?.(nextFilter)
    }

    function resetFilter() {
        emitChange(createDefaultFilter())
    }

    function summaryLabel(): string {
        if (!isActive) return 'Filter'
        return activeCount === 1 ? '1 rule' : `${activeCount} rules`
    }

    async function positionPanel() {
        await tick()

        if (!panelEl) {
            panelStyle = ''
            return
        }

        panelStyle = ''
        await tick()

        if (!panelEl) return

        panelStyle = computePopoverShift(panelEl)
    }

    async function toggleOpen() {
        if (disabled) return

        if (open) {
            setOpen(false)
            panelStyle = ''
            return
        }

        setOpen(true)
        await positionPanel()
    }

    function closePanel() {
        setOpen(false)
        panelStyle = ''
    }

    $effect(() => {
        if (open) {
            void activeCount
            void positionPanel()
        }
    })

    $effect(() => {
        if (!open || !rootEl) return

        const closeOnScroll = () => closePanel()
        const scrollParents = getScrollParents(rootEl)
        scrollParents.forEach((parent) => {
            parent.addEventListener('scroll', closeOnScroll, { passive: true })
        })

        return () => {
            scrollParents.forEach((parent) => {
                parent.removeEventListener('scroll', closeOnScroll)
            })
        }
    })

    $effect(() => {
        if (!open) return

        function handlePointerDown(event: PointerEvent) {
            const target = event.target
            if (!(target instanceof Node)) return
            if (rootEl?.contains(target) || panelEl?.contains(target)) return
            closePanel()
        }

        const timer = setTimeout(() => {
            document.addEventListener('pointerdown', handlePointerDown, true)
        }, 0)

        return () => {
            clearTimeout(timer)
            document.removeEventListener('pointerdown', handlePointerDown, true)
        }
    })
</script>

<div class="relative inline-flex" class:z-[100]={open} bind:this={rootEl}>
    <button
            type="button"
            class="btn btn-ghost btn-xs gap-1"
            class:btn-active={isActive}
            disabled={disabled}
            title={disabled ? (disabledTitle ?? 'Filter is disabled') : undefined}
            onclick={() => void toggleOpen()}
    >
        <Filter class="h-3.5 w-3.5 shrink-0" />
        <span class="max-w-20 truncate">{summaryLabel()}</span>
    </button>

    {#if open}
        <div
                bind:this={panelEl}
                class="absolute right-0 top-full z-[100] mt-1 w-[min(36rem,calc(100vw-1rem))] rounded-box border border-base-300 bg-base-100 p-4 shadow-xl"
                style={panelStyle}
        >
            <div class="mb-3 flex items-center justify-between gap-2">
                <div>
                    <h2 class="text-sm font-semibold">{panelTitle}</h2>
                    <p class="text-xs text-base-content/60">
                        {panelDescription}
                    </p>
                </div>
                <button type="button" class="btn btn-ghost btn-xs gap-1" onclick={resetFilter}>
                    <RotateCcw class="h-3.5 w-3.5" />
                    Clear
                </button>
            </div>

            <FilterGroupEditor
                    group={filter}
                    onChange={(nextFilter) => emitChange(nextFilter)}
            />
        </div>
    {/if}
</div>

<svelte:window
        onresize={() => {
            if (open) void positionPanel()
        }}
/>
