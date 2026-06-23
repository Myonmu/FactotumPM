<script lang="ts">
    import { Anvil, Clock, Dices, Puzzle, Trophy } from 'lucide-svelte'
    import { onMount } from 'svelte'

    import DomainIconInline from '$lib/components/DomainIconInline.svelte'
    import type { TaskRecord } from '$lib/db/dataView'
    import type { DomainOption } from '$lib/db/dataView'
    import { mixDisplayColorInt, resolveTaskColor } from '$lib/grid/colorUtils'
    import { ensureSessionTimeMaps, getTaskTimeMs } from '$lib/sessionTime.svelte'
    import { formatMetricDisplay, isMetricConfigured } from '$lib/taskMetrics'
    import { formatDurationMs } from '$lib/trophy/trophyTime'

    let {
        task,
        domains = [],
        dimmed = false,
        onClick,
    }: {
        task: TaskRecord
        domains?: DomainOption[]
        dimmed?: boolean
        onClick?: () => void
    } = $props()

    const taskColor = $derived(resolveTaskColor(task, domains))
    const taskBorderColor = $derived(mixDisplayColorInt(taskColor, ''))
    const uncertaintyLabel = $derived(
        formatMetricDisplay(task.uncertainty, task.uncertainty_can_estimate),
    )
    const complexityLabel = $derived(
        formatMetricDisplay(task.complexity, task.complexity_can_estimate),
    )
    const effortLabel = $derived(formatMetricDisplay(task.effort, task.effort_can_estimate))
    const showMetrics = $derived(
        isMetricConfigured(task.uncertainty_can_estimate)
            || isMetricConfigured(task.complexity_can_estimate)
            || isMetricConfigured(task.effort_can_estimate),
    )
    const timeSpentMs = $derived(getTaskTimeMs(task.id))

    onMount(() => {
        void ensureSessionTimeMaps()
    })
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_interactive_supports_focus -->
<div
        class="route-task-card card card-compact box-border h-full w-full cursor-grab overflow-hidden border border-base-300 bg-base-100 text-left shadow-sm transition-all hover:shadow-md active:cursor-grabbing"
        class:opacity-60={dimmed}
        class:saturate-50={dimmed}
        role="button"
        tabindex="0"
        style:border-color={taskBorderColor}
        style:background-color={taskColor != null
            ? `color-mix(in srgb, ${taskBorderColor} 12%, oklch(var(--b1)))`
            : ''}
        onclick={onClick}
        onkeydown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onClick?.()
            }
        }}
>
    <div class="card-body gap-1 p-2">
        <div class="flex items-start gap-2">
            <DomainIconInline domainId={task.domain_id} {domains} />
            <span class="flex-1 text-sm font-medium leading-snug line-clamp-2">{task.title}</span>
            {#if task.is_trophy}
                <Trophy class="h-4 w-4 shrink-0 opacity-100" color="oklch(var(--p))" />
            {/if}
        </div>

        {#if task.description?.trim()}
            <p class="line-clamp-2 text-xs leading-snug text-base-content/60">{task.description}</p>
        {/if}

        {#if showMetrics || timeSpentMs > 0}
            <div class="flex flex-wrap gap-1">
                {#if uncertaintyLabel != null}
                    <span class="badge badge-ghost badge-xs gap-1">
                        <Dices class="h-3 w-3 shrink-0" color="oklch(var(--p))" />
                        {uncertaintyLabel}
                    </span>
                {/if}
                {#if complexityLabel != null}
                    <span class="badge badge-ghost badge-xs gap-1">
                        <Puzzle class="h-3 w-3 shrink-0" color="oklch(var(--s))" />
                        {complexityLabel}
                    </span>
                {/if}
                {#if effortLabel != null}
                    <span class="badge badge-ghost badge-xs gap-1">
                        <Anvil class="h-3 w-3 shrink-0" color="oklch(var(--a))" />
                        {effortLabel}
                    </span>
                {/if}
                {#if timeSpentMs > 0}
                    <span class="badge badge-ghost badge-xs gap-1" title="Time spent">
                        <Clock class="h-3 w-3 shrink-0" color="oklch(var(--bc))" />
                        {formatDurationMs(timeSpentMs)}
                    </span>
                {/if}
            </div>
        {/if}
    </div>
</div>
