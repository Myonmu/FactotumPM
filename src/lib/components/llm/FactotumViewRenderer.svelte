<script lang="ts">
    import AftermathRefCard from '$lib/components/AftermathRefCard.svelte'
    import DomainRefChip from '$lib/components/DomainRefChip.svelte'
    import SessionRefCard from '$lib/components/SessionRefCard.svelte'
    import TaskRefCard from '$lib/components/TaskRefCard.svelte'
    import TaskStatusRefCard from '$lib/components/TaskStatusRefCard.svelte'
    import { loadDomainOptions, type DomainOption } from '$lib/db/dataView'
    import type { AftermathRecord } from '$lib/db/aftermath'
    import type { SessionRecord } from '$lib/db/sessions'
    import type { TaskStatusRecord } from '$lib/db/taskStatusMachine'
    import type { TaskRef } from '$lib/db/dataView'
    import { hydrateByViewType } from '$lib/llm/hydrateRecords'
    import type { ResolvedFactotumView } from '$lib/llm/types'
    import { effectiveViewType } from '$lib/llm/viewTypeInference'

    let { view }: { view: ResolvedFactotumView } = $props()

    let domains = $state<DomainOption[]>([])
    let tasks = $state<TaskRef[]>([])
    let sessions = $state<SessionRecord[]>([])
    let domainItems = $state<DomainOption[]>([])
    let aftermathItems = $state<AftermathRecord[]>([])
    let statusItems = $state<TaskStatusRecord[]>([])
    let loading = $state(true)

    const renderType = $derived(effectiveViewType(view))

    async function loadRenderedItems(currentView: ResolvedFactotumView) {
        loading = true
        domains = await loadDomainOptions()

        const type = effectiveViewType(currentView)
        const hydrated = await hydrateByViewType(type, currentView.entityIds)

        tasks = hydrated.kind === 'task' ? hydrated.items : []
        sessions = hydrated.kind === 'session' ? hydrated.items : []
        domainItems = hydrated.kind === 'domain' ? hydrated.items : []
        aftermathItems = hydrated.kind === 'aftermath' ? hydrated.items : []
        statusItems = hydrated.kind === 'task_status' ? hydrated.items : []

        loading = false
    }

    $effect(() => {
        void loadRenderedItems(view)
    })
</script>

{#if view.warning}
    <div class="alert alert-warning mb-3 text-sm">
        <span>{view.warning}</span>
    </div>
{/if}

{#if view.error}
    <div class="alert alert-error text-sm">
        <span>{view.error}</span>
    </div>
{:else if loading}
    <div class="flex min-h-12 items-center justify-center">
        <span class="loading loading-spinner loading-sm"></span>
    </div>
{:else if renderType === 'task'}
    {#if tasks.length === 0}
        <p class="text-sm text-base-content/60">No tasks returned.</p>
    {:else}
        <div class="flex flex-col gap-2">
            {#each tasks as task (task.id)}
                <TaskRefCard {task} {domains} class="w-full" />
            {/each}
        </div>
    {/if}
{:else if renderType === 'session'}
    {#if sessions.length === 0}
        <p class="text-sm text-base-content/60">No sessions returned.</p>
    {:else}
        <div class="flex flex-col gap-2">
            {#each sessions as session (session.id)}
                <SessionRefCard {session} {domains} class="w-full" />
            {/each}
        </div>
    {/if}
{:else if renderType === 'domain'}
    {#if domainItems.length === 0}
        <p class="text-sm text-base-content/60">No domains returned.</p>
    {:else}
        <div class="flex flex-wrap gap-2">
            {#each domainItems as domainItem (domainItem.id)}
                <DomainRefChip domain={domainItem} {domains} />
            {/each}
        </div>
    {/if}
{:else if renderType === 'aftermath'}
    {#if aftermathItems.length === 0}
        <p class="text-sm text-base-content/60">No aftermath entries returned.</p>
    {:else}
        <div class="flex flex-col gap-2">
            {#each aftermathItems as aftermath (aftermath.id)}
                <AftermathRefCard {aftermath} class="w-full" />
            {/each}
        </div>
    {/if}
{:else if renderType === 'task_status'}
    {#if statusItems.length === 0}
        <p class="text-sm text-base-content/60">No statuses returned.</p>
    {:else}
        <div class="flex flex-col gap-2">
            {#each statusItems as status (status.id)}
                <TaskStatusRefCard {status} class="w-full" />
            {/each}
        </div>
    {/if}
{:else if view.records.length === 0}
    <p class="text-sm text-base-content/60">No rows returned.</p>
{:else}
    <div class="overflow-x-auto">
        <table class="table table-zebra table-sm">
            <thead>
                <tr>
                    {#each view.columns as column (column)}
                        <th>{column}</th>
                    {/each}
                </tr>
            </thead>
            <tbody>
                {#each view.records as record, index (index)}
                    <tr>
                        {#each view.columns as column (column)}
                            <td>{String(record[column] ?? '')}</td>
                        {/each}
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
{/if}

{#if view.sql}
    <details class="mt-2 text-xs text-base-content/50">
        <summary class="cursor-pointer">Source SQL</summary>
        <pre class="mt-2 overflow-x-auto rounded bg-base-200 p-3 whitespace-pre-wrap">{view.sql}</pre>
    </details>
{/if}
