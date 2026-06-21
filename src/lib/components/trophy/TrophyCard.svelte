<script lang="ts">
    import { Anvil, Clock, Dices, Puzzle } from 'lucide-svelte'

    import TrophyIcon from '$lib/components/trophy/TrophyIcon.svelte'
    import type { DomainOption } from '$lib/db/dataView'
    import { mixDisplayColorInt, resolveTaskColor } from '$lib/grid/colorUtils'
    import { formatMetricDisplay, isMetricConfigured } from '$lib/taskMetrics'
    import type { TrophyView } from '$lib/trophy/computeTrophies'
    import { progressionPercent } from '$lib/trophy/trophyFields'
    import { formatDurationMs } from '$lib/trophy/trophyTime'

    let {
        view,
        domains = [],
        onClick,
    }: {
        view: TrophyView
        domains?: DomainOption[]
        onClick?: () => void
    } = $props()

    const task = $derived(view.task)
    const taskColor = $derived(resolveTaskColor(task, domains))
    const taskBorderColor = $derived(mixDisplayColorInt(taskColor, ''))

    const percent = $derived(progressionPercent(view))
    const lowerLabel = $derived(formatSize(view.lower))
    const upperLabel = $derived(formatSize(view.upper))

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

    function formatSize(value: number): string {
        if (!Number.isFinite(value)) return '0'
        if (value >= 100) return String(Math.round(value))
        return (Math.round(value * 10) / 10).toString()
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
        role="button"
        tabindex="0"
        class="trophy-card card card-compact w-full cursor-pointer border bg-base-100 text-left shadow-sm transition-all hover:shadow-md"
        class:border-base-300={!view.achieved}
        class:achieved={view.achieved}
        style:border-color={view.achieved ? view.type.colors[0] : taskBorderColor || undefined}
        style:--trophy-glow={view.type.colors[0]}
        style:background-color={taskColor != null
            ? `color-mix(in srgb, ${taskBorderColor} 10%, oklch(var(--b1)))`
            : ''}
        onclick={() => onClick?.()}
        onkeydown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onClick?.()
            }
        }}
>
    <div class="card-body gap-2 p-3">
        <div class="flex items-start gap-3">
            <div
                    class="tooltip tooltip-right shrink-0"
                    data-tip={view.type.label}
            >
                <TrophyIcon colors={view.type.colors} size={30} radiant={view.achieved} />
            </div>
            <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                    <span class="flex-1 truncate text-sm font-semibold leading-snug">
                        {task.title}
                    </span>
                    {#if view.achieved}
                        <span class="badge badge-xs border-0 font-semibold"
                              style:background-color={view.type.colors[0]}
                              style:color="#fff">
                            Achieved
                        </span>
                    {/if}
                </div>
                <p class="mt-0.5 truncate text-xs text-base-content/60">{view.type.shortLabel}</p>
            </div>
        </div>

        <div class="flex items-center justify-between text-xs">
            <span class="text-base-content/60">Size</span>
            <span class="font-mono font-semibold tabular-nums">{lowerLabel} – {upperLabel}</span>
        </div>

        <div class="flex items-center justify-between text-xs">
            <span class="flex items-center gap-1 text-base-content/60">
                <Clock class="h-3 w-3 shrink-0" />
                Time spent
            </span>
            <span class="font-mono font-semibold tabular-nums">{formatDurationMs(view.timeSpentMs)}</span>
        </div>

        <div class="flex items-center gap-2">
            <progress
                    class="progress h-2 flex-1"
                    class:progress-success={view.achieved}
                    value={percent}
                    max="100"
                    style:--glow={view.type.colors[0]}
            ></progress>
            <span class="w-9 shrink-0 text-right text-xs font-medium tabular-nums">{percent}%</span>
        </div>

        {#if showMetrics}
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
            </div>
        {/if}
    </div>
</div>

<style>
    .trophy-card.achieved {
        box-shadow:
            0 0 0 1px var(--trophy-glow),
            0 0 14px -2px var(--trophy-glow);
    }

    .trophy-card.achieved::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        background: radial-gradient(
            120% 120% at 50% 0%,
            color-mix(in srgb, var(--trophy-glow) 18%, transparent),
            transparent 60%
        );
    }

    .trophy-card {
        position: relative;
        overflow: hidden;
    }
</style>
