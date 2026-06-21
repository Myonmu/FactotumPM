<script lang="ts">
    import { ArrowDown, ArrowUp, Plus, Trash2, ArrowUpDown } from 'lucide-svelte'
    import { tick } from 'svelte'

    import {
        computePopoverShift,
        getScrollParents,
    } from '$lib/kanban/columnPopover'
    import { DEFAULT_COLUMN_SORT, TASK_ORDER_FIELDS } from '$lib/kanban/taskOrderFields'
    import type { ColumnSortConfig, SortRule } from '$lib/kanban/types'

    let {
        sortRules = [...DEFAULT_COLUMN_SORT],
        onChange,
        onOpenChange,
        disabled = false,
        disabledTitle,
    }: {
        sortRules?: ColumnSortConfig
        onChange?: (rules: ColumnSortConfig) => void
        onOpenChange?: (open: boolean) => void
        disabled?: boolean
        disabledTitle?: string
    } = $props()

    let open = $state(false)
    let rootEl = $state<HTMLDivElement | null>(null)
    let panelEl = $state<HTMLDivElement | null>(null)
    let panelStyle = $state('')

    function setOpen(nextOpen: boolean) {
        open = nextOpen
        onOpenChange?.(nextOpen)
    }

    function emitChange(nextRules: ColumnSortConfig) {
        onChange?.(nextRules)
    }

    function updateRule(index: number, patch: Partial<SortRule>) {
        const nextRules = sortRules.map((rule, ruleIndex) =>
            ruleIndex === index ? { ...rule, ...patch } : rule,
        )
        emitChange(nextRules)
    }

    function removeRule(index: number) {
        const nextRules = sortRules.filter((_, ruleIndex) => ruleIndex !== index)
        emitChange(nextRules.length > 0 ? nextRules : [...DEFAULT_COLUMN_SORT])
    }

    function addRule() {
        const usedFields = new Set(sortRules.map((rule) => rule.field))
        const nextField =
            TASK_ORDER_FIELDS.find((field) => !usedFields.has(field.id))?.id ?? 'title'

        emitChange([...sortRules, { field: nextField, direction: 'asc' }])
    }

    function resetRules() {
        emitChange([...DEFAULT_COLUMN_SORT])
    }

    function toggleDirection(index: number) {
        const rule = sortRules[index]
        if (!rule) return
        updateRule(index, { direction: rule.direction === 'asc' ? 'desc' : 'asc' })
    }

    function summaryLabel(): string {
        if (sortRules.length === 0) return 'Sort'
        const first = sortRules[0]
        const fieldLabel =
            TASK_ORDER_FIELDS.find((field) => field.id === first.field)?.label ?? first.field
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
            void sortRules.length
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
            disabled={disabled}
            title={disabled ? (disabledTitle ?? 'Sort is disabled') : undefined}
            onclick={() => void toggleOpen()}
    >
        <ArrowUpDown class="h-3.5 w-3.5 shrink-0" />
        <span class="max-w-24 truncate">{summaryLabel()}</span>
    </button>

    {#if open}
        <div
                bind:this={panelEl}
                class="absolute left-0 top-full z-[100] mt-1 w-72 rounded-box border border-base-300 bg-base-100 p-3 shadow-xl"
                style={panelStyle}
        >
            <div class="mb-2 flex items-center justify-between gap-2">
                <span class="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                    Order by
                </span>
                <button type="button" class="btn btn-ghost btn-xs" onclick={resetRules}>
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
                                    updateRule(index, {
                                        field: (event.currentTarget as HTMLSelectElement).value,
                                    })}
                        >
                            {#each TASK_ORDER_FIELDS as field (field.id)}
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

<svelte:window
        onresize={() => {
            if (open) void positionPanel()
        }}
/>
