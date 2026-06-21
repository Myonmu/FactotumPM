<script lang="ts">
    import { ArrowDown, ArrowUp, ArrowUpDown, Plus, Trash2 } from 'lucide-svelte'
    import { tick } from 'svelte'

    import { computePopoverShift, getScrollParents } from '$lib/kanban/columnPopover'
    import type { ColumnSortConfig, SortRule } from '$lib/kanban/types'
    import { DEFAULT_TROPHY_SORT, TROPHY_ORDER_FIELDS } from '$lib/trophy/trophyFields'

    let {
        sortRules = [...DEFAULT_TROPHY_SORT],
        onChange,
    }: {
        sortRules?: ColumnSortConfig
        onChange?: (rules: ColumnSortConfig) => void
    } = $props()

    let open = $state(false)
    let rootEl = $state<HTMLDivElement | null>(null)
    let panelEl = $state<HTMLDivElement | null>(null)
    let panelStyle = $state('')

    function emitChange(nextRules: ColumnSortConfig) {
        onChange?.(nextRules)
    }

    function updateRule(index: number, patch: Partial<SortRule>) {
        emitChange(sortRules.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, ...patch } : rule)))
    }

    function removeRule(index: number) {
        const nextRules = sortRules.filter((_, ruleIndex) => ruleIndex !== index)
        emitChange(nextRules.length > 0 ? nextRules : [...DEFAULT_TROPHY_SORT])
    }

    function addRule() {
        const usedFields = new Set(sortRules.map((rule) => rule.field))
        const nextField = TROPHY_ORDER_FIELDS.find((field) => !usedFields.has(field.id))?.id ?? 'title'
        emitChange([...sortRules, { field: nextField, direction: 'asc' }])
    }

    function toggleDirection(index: number) {
        const rule = sortRules[index]
        if (!rule) return
        updateRule(index, { direction: rule.direction === 'asc' ? 'desc' : 'asc' })
    }

    function summaryLabel(): string {
        if (sortRules.length === 0) return 'Sort'
        const first = sortRules[0]
        const fieldLabel = TROPHY_ORDER_FIELDS.find((field) => field.id === first.field)?.label ?? first.field
        const suffix = sortRules.length > 1 ? ` +${sortRules.length - 1}` : ''
        return `${fieldLabel}${suffix}`
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
            void sortRules.length
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
    <button type="button" class="btn btn-sm btn-ghost gap-1" onclick={() => void toggleOpen()}>
        <ArrowUpDown class="h-4 w-4 shrink-0" />
        <span class="max-w-28 truncate">{summaryLabel()}</span>
    </button>

    {#if open}
        <div
                bind:this={panelEl}
                class="absolute left-0 top-full z-[100] mt-1 w-72 rounded-box border border-base-300 bg-base-100 p-3 shadow-xl"
                style={panelStyle}
        >
            <div class="mb-2 flex items-center justify-between gap-2">
                <span class="text-xs font-semibold uppercase tracking-wide text-base-content/60">Order by</span>
                <button type="button" class="btn btn-ghost btn-xs" onclick={() => emitChange([...DEFAULT_TROPHY_SORT])}>
                    Reset
                </button>
            </div>

            <div class="space-y-2">
                {#each sortRules as rule, index (index)}
                    <div class="flex items-center gap-1">
                        {#if index > 0}
                            <span class="w-8 shrink-0 text-[10px] uppercase text-base-content/50">then</span>
                        {:else}
                            <span class="w-8 shrink-0"></span>
                        {/if}

                        <select
                                class="select select-bordered select-sm h-9 min-h-9 min-w-0 flex-1 py-0 text-sm leading-normal"
                                value={rule.field}
                                onchange={(event) =>
                                    updateRule(index, { field: (event.currentTarget as HTMLSelectElement).value })}
                        >
                            {#each TROPHY_ORDER_FIELDS as field (field.id)}
                                <option value={field.id}>{field.label}</option>
                            {/each}
                        </select>

                        <button
                                type="button"
                                class="btn btn-ghost btn-xs btn-square shrink-0"
                                title={rule.direction === 'asc' ? 'Ascending' : 'Descending'}
                                onclick={() => toggleDirection(index)}
                        >
                            {#if rule.direction === 'asc'}
                                <ArrowUp class="h-3.5 w-3.5" />
                            {:else}
                                <ArrowDown class="h-3.5 w-3.5" />
                            {/if}
                        </button>

                        <button
                                type="button"
                                class="btn btn-ghost btn-xs btn-square shrink-0 text-error"
                                title="Remove sort level"
                                onclick={() => removeRule(index)}
                                disabled={sortRules.length === 1}
                        >
                            <Trash2 class="h-3.5 w-3.5" />
                        </button>
                    </div>
                {/each}
            </div>

            <button type="button" class="btn btn-ghost btn-xs mt-2 gap-1" onclick={addRule}>
                <Plus class="h-3.5 w-3.5" />
                Add sort level
            </button>
        </div>
    {/if}
</div>

<svelte:window onresize={() => { if (open) void positionPanel() }} />
