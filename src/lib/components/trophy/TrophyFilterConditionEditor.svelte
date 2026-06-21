<script lang="ts">
    import { Trash2 } from 'lucide-svelte'

    import type { DomainOption } from '$lib/db/dataView'
    import type { FilterCondition } from '$lib/kanban/filterTypes'
    import { getOperatorLabel } from '$lib/kanban/taskFilterFields'
    import { allTrophyTypeShortLabels } from '$lib/trophy/computeTrophies'
    import {
        getTrophyDefaultOperator,
        getTrophyFilterField,
        TROPHY_FILTER_FIELDS,
        trophyOperatorNeedsValue,
    } from '$lib/trophy/trophyFields'

    let {
        condition,
        domains = [],
        statuses = [],
        onChange,
        onRemove,
    }: {
        condition: FilterCondition
        domains?: DomainOption[]
        statuses?: { id: string; title: string }[]
        onChange?: (nextCondition: FilterCondition) => void
        onRemove?: () => void
    } = $props()

    const fieldDef = $derived(getTrophyFilterField(condition.field))
    const needsValue = $derived(trophyOperatorNeedsValue(condition.operator))
    const typeLabels = allTrophyTypeShortLabels()

    function emitChange(patch: Partial<FilterCondition>) {
        onChange?.({ ...condition, ...patch })
    }

    function handleFieldChange(field: string) {
        emitChange({ field, operator: getTrophyDefaultOperator(field), value: '' })
    }
</script>

<div class="flex flex-wrap items-center gap-1 rounded-box border border-base-300 bg-base-200/40 p-2">
    <select
            class="select select-bordered select-sm h-9 min-h-9 min-w-[7rem] flex-1 py-0 text-sm leading-normal"
            value={condition.field}
            onchange={(event) => handleFieldChange((event.currentTarget as HTMLSelectElement).value)}
    >
        {#each TROPHY_FILTER_FIELDS as field (field.id)}
            <option value={field.id}>{field.label}</option>
        {/each}
    </select>

    <select
            class="select select-bordered select-sm h-9 min-h-9 min-w-[7rem] flex-1 py-0 text-sm leading-normal"
            value={condition.operator}
            onchange={(event) =>
                emitChange({
                    operator: (event.currentTarget as HTMLSelectElement)
                        .value as FilterCondition['operator'],
                })}
    >
        {#each fieldDef?.operators ?? [] as operator (operator)}
            <option value={operator}>{getOperatorLabel(operator)}</option>
        {/each}
    </select>

    {#if needsValue}
        {#if fieldDef?.kind === 'domain'}
            <select
                    class="select select-bordered select-sm h-9 min-h-9 min-w-[8rem] flex-[1.2] py-0 text-sm leading-normal"
                    value={condition.value ?? ''}
                    onchange={(event) =>
                        emitChange({ value: (event.currentTarget as HTMLSelectElement).value })}
            >
                <option value="">Select…</option>
                {#each domains as domain (domain.id)}
                    <option value={domain.id}>{domain.title}</option>
                {/each}
            </select>
        {:else if fieldDef?.kind === 'status'}
            <select
                    class="select select-bordered select-sm h-9 min-h-9 min-w-[8rem] flex-[1.2] py-0 text-sm leading-normal"
                    value={condition.value ?? ''}
                    onchange={(event) =>
                        emitChange({ value: (event.currentTarget as HTMLSelectElement).value })}
            >
                <option value="">Select…</option>
                {#each statuses as status (status.id)}
                    <option value={status.id}>{status.title}</option>
                {/each}
            </select>
        {:else if fieldDef?.kind === 'type'}
            <select
                    class="select select-bordered select-sm h-9 min-h-9 min-w-[8rem] flex-[1.2] py-0 text-sm leading-normal"
                    value={condition.value ?? ''}
                    onchange={(event) =>
                        emitChange({ value: (event.currentTarget as HTMLSelectElement).value })}
            >
                <option value="">Select…</option>
                {#each typeLabels as label (label)}
                    <option value={label}>{label}</option>
                {/each}
            </select>
        {:else if fieldDef?.kind === 'metric'}
            <input
                    type="number"
                    class="input input-bordered input-sm h-9 min-h-9 w-20"
                    min="0"
                    max="10"
                    value={condition.value ?? ''}
                    oninput={(event) =>
                        emitChange({ value: Number((event.currentTarget as HTMLInputElement).value) })}
            />
        {:else if fieldDef?.kind === 'number'}
            <input
                    type="number"
                    class="input input-bordered input-sm h-9 min-h-9 w-24"
                    value={condition.value ?? ''}
                    oninput={(event) =>
                        emitChange({ value: Number((event.currentTarget as HTMLInputElement).value) })}
            />
        {:else if fieldDef?.kind === 'datetime'}
            <input
                    type="datetime-local"
                    class="input input-bordered input-sm h-9 min-h-9 min-w-[11rem] flex-[1.2]"
                    value={condition.value ?? ''}
                    oninput={(event) =>
                        emitChange({ value: (event.currentTarget as HTMLInputElement).value })}
            />
        {:else}
            <input
                    type="text"
                    class="input input-bordered input-sm h-9 min-h-9 min-w-[8rem] flex-[1.2]"
                    placeholder="Value"
                    value={condition.value ?? ''}
                    oninput={(event) =>
                        emitChange({ value: (event.currentTarget as HTMLInputElement).value })}
            />
        {/if}
    {/if}

    <button
            type="button"
            class="btn btn-ghost btn-xs btn-square shrink-0 text-error"
            title="Remove condition"
            onclick={() => onRemove?.()}
    >
        <Trash2 class="h-3.5 w-3.5" />
    </button>
</div>
