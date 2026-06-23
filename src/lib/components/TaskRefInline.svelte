<script lang="ts">
    import { Anvil, Clock, Dices, Puzzle, Trophy } from 'lucide-svelte'
    import { onMount } from 'svelte'

    import DomainIconInline from '$lib/components/DomainIconInline.svelte'
    import type { DomainOption, TaskRef } from '$lib/db/dataView'
    import { ensureSessionTimeMaps, getTaskTimeMs } from '$lib/sessionTime.svelte'
    import { formatMetricDisplay, isMetricConfigured } from '$lib/taskMetrics'
    import { formatDurationMs } from '$lib/trophy/trophyTime'

    let {
        task,
        domains = [],
        expanded = false,
        class: className = '',
    }: {
        task: TaskRef
        domains?: DomainOption[]
        expanded?: boolean
        class?: string
    } = $props()

    const uncertaintyLabel = $derived(
        formatMetricDisplay(task.uncertainty, task.uncertainty_can_estimate),
    )
    const complexityLabel = $derived(
        formatMetricDisplay(task.complexity, task.complexity_can_estimate),
    )
    const effortLabel = $derived(formatMetricDisplay(task.effort, task.effort_can_estimate))
    const showMetrics = $derived(
        isMetricConfigured(task.uncertainty_can_estimate) ||
            isMetricConfigured(task.complexity_can_estimate) ||
            isMetricConfigured(task.effort_can_estimate),
    )
    const timeSpentMs = $derived(getTaskTimeMs(task.id))

    onMount(() => {
        void ensureSessionTimeMaps()
    })
</script>

<span
        class="flex min-w-0 flex-1 items-center gap-2 {className}"
        class:flex-wrap={expanded}
>
    <DomainIconInline domainId={task.domain_id} {domains} />
    <span
            class="min-w-0 flex-1 text-sm font-medium leading-snug"
            class:truncate={!expanded}
            class:whitespace-normal={expanded}
    >{task.title}</span>

    {#if task.is_trophy}
        <Trophy class="h-3.5 w-3.5 shrink-0" color="oklch(var(--p))" />
    {/if}

    {#if showMetrics || timeSpentMs > 0}
        <span class="flex shrink-0 items-center gap-1">
            {#if uncertaintyLabel != null}
                <span class="badge badge-ghost badge-xs gap-0.5 px-1">
                    <Dices class="h-2.5 w-2.5 shrink-0" color="oklch(var(--p))" />
                    {uncertaintyLabel}
                </span>
            {/if}
            {#if complexityLabel != null}
                <span class="badge badge-ghost badge-xs gap-0.5 px-1">
                    <Puzzle class="h-2.5 w-2.5 shrink-0" color="oklch(var(--s))" />
                    {complexityLabel}
                </span>
            {/if}
            {#if effortLabel != null}
                <span class="badge badge-ghost badge-xs gap-0.5 px-1">
                    <Anvil class="h-2.5 w-2.5 shrink-0" color="oklch(var(--a))" />
                    {effortLabel}
                </span>
            {/if}
            {#if timeSpentMs > 0}
                <span class="badge badge-ghost badge-xs gap-0.5 px-1" title="Time spent">
                    <Clock class="h-2.5 w-2.5 shrink-0" color="oklch(var(--bc))" />
                    {formatDurationMs(timeSpentMs)}
                </span>
            {/if}
        </span>
    {/if}
</span>
