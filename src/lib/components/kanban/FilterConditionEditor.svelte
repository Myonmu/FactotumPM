<script lang="ts">
    import { Trash2 } from 'lucide-svelte'

    import type { FilterCondition } from '$lib/kanban/filterTypes'
    import {
        getDefaultOperator,
        getFilterField,
        getOperatorLabel,
        operatorNeedsValue,
        TASK_FILTER_FIELDS,
    } from '$lib/kanban/taskFilterFields'
    import {
        loadDomainOptions,
        loadTaskOptions,
        type DomainOption,
        type TaskRef,
    } from '$lib/db/dataView'
    import { loadTaskStatusOptions } from '$lib/db/taskStatusMachine'

    let {
        condition,
        onChange,
        onRemove,
    }: {
        condition: FilterCondition
        onChange?: (nextCondition: FilterCondition) => void
        onRemove?: () => void
    } = $props()

    let domains = $state<DomainOption[]>([])
    let statuses = $state<{ id: string; title: string }[]>([])
    let tasks = $state<TaskRef[]>([])
    let optionsLoaded = $state(false)

    const fieldDef = $derived(getFilterField(condition.field))
    const needsValue = $derived(operatorNeedsValue(condition.operator))

    function emitChange(patch: Partial<FilterCondition>) {
        onChange?.({ ...condition, ...patch })
    }

    function handleFieldChange(field: string) {
        emitChange({
            field,
            operator: getDefaultOperator(field),
            value: '',
        })
    }

    async function ensureOptionsLoaded() {
        if (optionsLoaded) return

        const [loadedDomains, loadedStatuses, loadedTasks] = await Promise.all([
            loadDomainOptions(),
            loadTaskStatusOptions(),
            loadTaskOptions(),
        ])

        domains = loadedDomains
        statuses = loadedStatuses
        tasks = loadedTasks
        optionsLoaded = true
    }

    $effect(() => {
        if (fieldDef?.kind === 'reference') {
            void ensureOptionsLoaded()
        }
    })
</script>

<div class="flex flex-wrap items-center gap-1 rounded-box border border-base-300 bg-base-200/40 p-2">
    <select
            class="select select-bordered select-sm h-9 min-h-9 min-w-[7rem] flex-1 py-0 text-sm leading-normal"
            value={condition.field}
            onchange={(event) =>
                handleFieldChange((event.currentTarget as HTMLSelectElement).value)}
    >
        {#each TASK_FILTER_FIELDS as field (field.id)}
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
        {#if fieldDef?.kind === 'reference'}
            <select
                    class="select select-bordered select-sm h-9 min-h-9 min-w-[8rem] flex-[1.2] py-0 text-sm leading-normal"
                    value={condition.value ?? ''}
                    onchange={(event) =>
                        emitChange({ value: (event.currentTarget as HTMLSelectElement).value })}
            >
                <option value="">Select…</option>
                {#if condition.field === 'domain_id'}
                    {#each domains as domain (domain.id)}
                        <option value={domain.id}>{domain.title}</option>
                    {/each}
                {:else if condition.field === 'task_status_id'}
                    {#each statuses as status (status.id)}
                        <option value={status.id}>{status.title}</option>
                    {/each}
                {:else if condition.field === 'parent_task_id'}
                    {#each tasks as task (task.id)}
                        <option value={task.id}>{task.title}</option>
                    {/each}
                {/if}
            </select>
        {:else if fieldDef?.kind === 'metric'}
            <input
                    type="number"
                    class="input input-bordered input-sm h-9 min-h-9 w-20"
                    min="0"
                    max="10"
                    value={condition.value ?? ''}
                    oninput={(event) =>
                        emitChange({
                            value: Number((event.currentTarget as HTMLInputElement).value),
                        })}
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
