<script lang="ts">
    import { Filter, RotateCcw } from 'lucide-svelte'
    import { tick } from 'svelte'

    import TrophyFilterGroupEditor from '$lib/components/trophy/TrophyFilterGroupEditor.svelte'
    import type { DomainOption } from '$lib/db/dataView'
    import { computePopoverShift, getScrollParents } from '$lib/kanban/columnPopover'
    import type { KanbanFilterRoot } from '$lib/kanban/filterTypes'
    import { countFilterConditions, createDefaultFilter, isFilterActive } from '$lib/kanban/filterUtils'

    let {
        filter = createDefaultFilter(),
        domains = [],
        statuses = [],
        onChange,
    }: {
        filter?: KanbanFilterRoot
        domains?: DomainOption[]
        statuses?: { id: string; title: string }[]
        onChange?: (nextFilter: KanbanFilterRoot) => void
    } = $props()

    let open = $state(false)
    let rootEl = $state<HTMLDivElement | null>(null)
    let panelEl = $state<HTMLDivElement | null>(null)
    let panelStyle = $state('')

    const activeCount = $derived(countFilterConditions(filter))
    const isActive = $derived(isFilterActive(filter))

    function emitChange(nextFilter: KanbanFilterRoot) {
        onChange?.(nextFilter)
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
        if (open) {
            open = false
            panelStyle = ''
            return
        }
        open = true
        await positionPanel()
    }

    function closePanel() {
        open = false
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
        scrollParents.forEach((parent) => parent.addEventListener('scroll', closeOnScroll, { passive: true }))
        return () => {
            scrollParents.forEach((parent) => parent.removeEventListener('scroll', closeOnScroll))
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
    <button type="button" class="btn btn-sm btn-ghost gap-1" class:btn-active={isActive} onclick={() => void toggleOpen()}>
        <Filter class="h-4 w-4 shrink-0" />
        <span class="max-w-24 truncate">{summaryLabel()}</span>
    </button>

    {#if open}
        <div
                bind:this={panelEl}
                class="absolute right-0 top-full z-[100] mt-1 w-[min(40rem,calc(100vw-1rem))] rounded-box border border-base-300 bg-base-100 p-4 shadow-xl"
                style={panelStyle}
        >
            <div class="mb-3 flex items-center justify-between gap-2">
                <div>
                    <h2 class="text-sm font-semibold">Trophy filters</h2>
                    <p class="text-xs text-base-content/60">
                        Filter by schema fields, size, progression and type.
                    </p>
                </div>
                <button type="button" class="btn btn-ghost btn-xs gap-1" onclick={() => emitChange(createDefaultFilter())}>
                    <RotateCcw class="h-3.5 w-3.5" />
                    Clear
                </button>
            </div>

            <TrophyFilterGroupEditor
                    group={filter}
                    {domains}
                    {statuses}
                    onChange={(nextFilter) => emitChange(nextFilter)}
            />
        </div>
    {/if}
</div>

<svelte:window onresize={() => { if (open) void positionPanel() }} />
