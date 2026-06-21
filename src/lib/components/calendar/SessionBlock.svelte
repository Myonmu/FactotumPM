<script lang="ts">
    import type { SessionRecord } from '$lib/db/sessions'
    import { getSessionDisplayTitle } from '$lib/db/sessions'
    import { parseSqlTimestamp } from '$lib/calendar/dates'
    import { formatSessionRelativeTime } from '$lib/calendar/sessionRelativeTime'
    import { sessionHasEvaluatedAftermath } from '$lib/dashboard/sessionUtils'
    import { mixDisplayColorInt } from '$lib/grid/colorUtils'

    let {
        session,
        compact = false,
        fill = false,
        showTime = true,
        timeFormat = 'auto',
        now = new Date(),
        dragging = false,
        interactive = true,
        onclick,
        onPointerDragStart,
    }: {
        session: SessionRecord
        compact?: boolean
        fill?: boolean
        showTime?: boolean
        timeFormat?: 'auto' | 'relative' | 'absolute'
        now?: Date
        dragging?: boolean
        interactive?: boolean
        onclick?: () => void
        onPointerDragStart?: (event: PointerEvent) => void
    } = $props()

    let didDrag = $state(false)
    let pointerStartX = 0
    let pointerStartY = 0

    function sessionColor(color: number | null | undefined): string {
        return mixDisplayColorInt(color)
    }

    const displayColor = $derived(sessionColor(session.task_color))

    const label = $derived(getSessionDisplayTitle(session))

    const isDimmed = $derived(
        dragging || sessionHasEvaluatedAftermath(session),
    )

    const timeLabel = $derived.by(() => {
        const useRelative =
            timeFormat === 'relative' || (timeFormat === 'auto' && !fill)

        if (useRelative) {
            return formatSessionRelativeTime(session, now)
        }

        const start = parseSqlTimestamp(session.started_at)
        const end = parseSqlTimestamp(session.ended_at)

        if (!start) return ''

        const startText = start.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
        })

        if (!end) return startText

        const endText = end.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
        })

        return `${startText} – ${endText}`
    })

    function handlePointerDown(event: PointerEvent) {
        const dragStart = onPointerDragStart
        if (!dragStart || event.button !== 0) return

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
                dragStart(moveEvent)
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

        onclick?.()
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if interactive}
<button
        type="button"
        class="session-block block w-full rounded-md border px-2 py-1 text-left transition-opacity hover:opacity-90"
        class:text-xs={compact}
        class:py-0.5={compact}
        class:h-full={fill}
        class:min-h-0={fill}
        class:rounded-none={fill}
        class:border-0={fill}
        class:opacity-50={isDimmed}
        class:cursor-grab={onPointerDragStart}
        class:active:cursor-grabbing={onPointerDragStart}
        style:background-color={fill ? 'transparent' : `color-mix(in srgb, ${displayColor} 18%, transparent)`}
        style:border-color={fill ? 'transparent' : displayColor}
        onpointerdown={handlePointerDown}
        onclick={handleClick}
>
    <span class="block truncate font-medium leading-tight">{label}</span>
    {#if showTime && timeLabel}
        <span class="block truncate text-[0.7rem] text-base-content/70">{timeLabel}</span>
    {/if}
</button>
{:else}
<div
        class="session-block block w-full rounded-md border px-2 py-1 text-left"
        class:text-xs={compact}
        class:py-0.5={compact}
        class:h-full={fill}
        class:min-h-0={fill}
        class:rounded-none={fill}
        class:border-0={fill}
        class:opacity-50={isDimmed}
        style:background-color={fill ? 'transparent' : `color-mix(in srgb, ${displayColor} 18%, transparent)`}
        style:border-color={fill ? 'transparent' : displayColor}
>
    <span class="block truncate font-medium leading-tight">{label}</span>
    {#if showTime && timeLabel}
        <span class="block truncate text-[0.7rem] text-base-content/70">{timeLabel}</span>
    {/if}
</div>
{/if}
