<script lang="ts">
    import { onMount } from 'svelte'
    import type { Snippet } from 'svelte'

    import SessionBlock from '$lib/components/calendar/SessionBlock.svelte'
    import SessionRefCard from '$lib/components/SessionRefCard.svelte'
    import TaskRefCard from '$lib/components/TaskRefCard.svelte'
    import { loadDomainOptions, type DomainOption } from '$lib/db/dataView'
    import type { SessionRecord } from '$lib/db/sessions'
    import { sessionStatusLabel } from '$lib/dashboard/sessionUtils'

    let {
        session,
        showStatus = false,
        showTasks = true,
        compact = false,
        now = new Date(),
        domains: domainsProp = [],
        actions,
    }: {
        session: SessionRecord
        showStatus?: boolean
        showTasks?: boolean
        compact?: boolean
        now?: Date
        domains?: DomainOption[]
        actions?: Snippet
    } = $props()

    let loadedDomains = $state<DomainOption[]>([])

    const domains = $derived(domainsProp.length > 0 ? domainsProp : loadedDomains)
    const embedSingleTask = $derived(showTasks && session.tasks.length === 1)

    onMount(() => {
        void loadDomainOptions().then((loaded) => {
            loadedDomains = loaded
        })
    })
</script>

<div
        class="session-with-task flex items-start gap-4 rounded-box border border-base-300 bg-base-100 p-4 shadow-sm"
        class:p-3={compact}
>
    <div class="min-w-0 flex-1">
        {#if embedSingleTask}
            <SessionRefCard {session} {domains} {now} class="w-full" />
        {:else}
            <SessionBlock {session} {domains} {compact} {now} interactive={false} />
        {/if}

        {#if showTasks && session.tasks.length > 1}
            <ul class="mt-2 flex flex-col gap-1.5">
                {#each session.tasks as task (task.id)}
                    <li>
                        <TaskRefCard {task} {domains} />
                    </li>
                {/each}
            </ul>
        {/if}

        {#if showStatus}
            <span class="mt-1 inline-block text-xs text-base-content/60">
                {sessionStatusLabel(session.status)}
            </span>
        {/if}
    </div>

    {#if actions}
        <div class="flex shrink-0 flex-col gap-2">
            {@render actions()}
        </div>
    {/if}
</div>
