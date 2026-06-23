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
        dragging = false,
        compact = false,
        dimmed = false,
        preview = false,
        onPointerDragStart,
        onClick,
    }: {
        task: TaskRecord
        domains?: DomainOption[]
        dragging?: boolean
        compact?: boolean
        dimmed?: boolean
        preview?: boolean
        onPointerDragStart?: (event: PointerEvent, taskId: string) => void
        onClick?: () => void
    } = $props()

    let didDrag = $state(false)
    let pointerStartX = 0
    let pointerStartY = 0

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
        isMetricConfigured(task.uncertainty_can_estimate) ||
            isMetricConfigured(task.complexity_can_estimate) ||
            isMetricConfigured(task.effort_can_estimate),
    )
    const timeSpentMs = $derived(getTaskTimeMs(task.id))

    onMount(() => {
        void ensureSessionTimeMaps()
    })

    function handlePointerDown(event: PointerEvent) {
        if (event.button !== 0) return

        didDrag = false
        pointerStartX = event.clientX
        pointerStartY = event.clientY

        function handlePointerMove(moveEvent: PointerEvent) {
            const dx = moveEvent.clientX - pointerStartX
            const dy = moveEvent.clientY - pointerStartY
            if (!didDrag && Math.hypot(dx, dy) >= 6) {
                didDrag = true
                window.removeEventListener('pointermove', handlePointerMove)
                window.removeEventListener('pointerup', handlePointerUp)
                onPointerDragStart?.(moveEvent, task.id)
            }
        }

        function handlePointerUp() {
            window.removeEventListener('pointermove', handlePointerMove)
            window.removeEventListener('pointerup', handlePointerUp)
        }

        window.addEventListener('pointermove', handlePointerMove)
        window.addEventListener('pointerup', handlePointerUp)
    }

    function handleClick() {
        if (didDrag) {
            didDrag = false
            return
        }
        onClick?.()
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
        role={preview ? 'presentation' : 'button'}
        tabindex={preview ? undefined : 0}
        class="kanban-card card card-compact w-full border border-base-300 bg-base-100 text-left shadow-sm transition-all"
        class:cursor-grab={!preview}
        class:hover:shadow-md={!preview}
        class:active:cursor-grabbing={!preview}
        class:cursor-default={preview}
        class:pointer-events-none={preview}
        class:opacity-50={dragging}
        class:opacity-60={dimmed && !dragging}
        class:saturate-50={dimmed && !dragging}
        class:ring-2={dragging}
        class:ring-primary={dragging}
        style:border-color={taskBorderColor}
        style:background-color={taskColor != null ? `color-mix(in srgb, ${taskBorderColor} 12%, oklch(var(--b1)))` : ''}
        data-task-id={task.id}
        onpointerdown={preview ? undefined : handlePointerDown}
        onclick={preview ? undefined : handleClick}
        onkeydown={preview ? undefined : (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onClick?.()
            }
        }}
>
    <div class="card-body gap-2 p-3" class:gap-1={compact} class:p-2={compact}>
        <div class="flex items-start gap-2">
            <DomainIconInline domainId={task.domain_id} {domains} />
            <span class="flex-1 text-sm font-medium leading-snug">{task.title}</span>
            {#if task.is_trophy}
                <Trophy class="h-4 w-4 shrink-0 opacity-100" color="oklch(var(--p))" />
            {/if}
        </div>

        {#if task.description}
            <p
                    class="text-xs text-base-content/60"
                    class:line-clamp-2={!compact && !preview}
                    class:line-clamp-1={compact && !preview}
                    class:whitespace-pre-wrap={preview}
            >
                {task.description}
            </p>
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
