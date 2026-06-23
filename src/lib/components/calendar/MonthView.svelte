<script lang="ts">
    import SessionBlock from '$lib/components/calendar/SessionBlock.svelte'
    import {
        isSameDay,
        isToday,
        parseSqlTimestamp,
        WEEKDAY_LABELS,
    } from '$lib/calendar/dates'
    import { dayFromPointer, moveSessionToDay } from '$lib/calendar/sessionTiming'
    import type { DomainOption } from '$lib/db/dataView'
    import type { SessionRecord } from '$lib/db/sessions'

    const MAX_VISIBLE_SESSIONS = 3

    let {
        days,
        anchorMonth,
        sessions = [],
        domains = [],
        onDayClick,
        onSessionClick,
        onCreateSession,
        onSessionDayChange,
    }: {
        days: Date[]
        anchorMonth: number
        sessions?: SessionRecord[]
        domains?: DomainOption[]
        onDayClick?: (day: Date) => void
        onSessionClick?: (session: SessionRecord) => void
        onCreateSession?: (day: Date) => void
        onSessionDayChange?: (
            session: SessionRecord,
            targetDay: Date,
            started_at: string,
            ended_at: string,
        ) => void | Promise<void>
    } = $props()

    let draggingSessionId = $state<string | null>(null)
    let dropTargetDay = $state<Date | null>(null)

    function sessionsForDay(day: Date): SessionRecord[] {
        return sessions.filter((entry) => {
            const start = parseSqlTimestamp(entry.started_at)
            return start ? isSameDay(start, day) : false
        })
    }

    function isDropTarget(day: Date): boolean {
        return dropTargetDay ? isSameDay(dropTargetDay, day) : false
    }

    function startSessionDrag(event: PointerEvent, session: SessionRecord) {
        if (!onSessionDayChange) return

        const originStart = session.started_at
        const originEnd = session.ended_at
        const originDay = parseSqlTimestamp(originStart)

        draggingSessionId = session.id

        function handlePointerMove(moveEvent: PointerEvent) {
            dropTargetDay = dayFromPointer(moveEvent)
        }

        async function handlePointerUp(moveEvent: PointerEvent) {
            window.removeEventListener('pointermove', handlePointerMove)
            window.removeEventListener('pointerup', handlePointerUp)

            const targetDay = dayFromPointer(moveEvent)

            if (
                targetDay
                && originDay
                && !isSameDay(targetDay, originDay)
            ) {
                const moved = moveSessionToDay(originStart, originEnd, targetDay)
                await onSessionDayChange?.(
                    session,
                    targetDay,
                    moved.started_at,
                    moved.ended_at,
                )
            }

            draggingSessionId = null
            dropTargetDay = null
        }

        window.addEventListener('pointermove', handlePointerMove)
        window.addEventListener('pointerup', handlePointerUp)
    }
</script>

<div class="month-view flex min-h-0 flex-1 flex-col overflow-hidden rounded-box border border-base-300 bg-base-100">
    <div class="grid grid-cols-7 border-b border-base-300 bg-base-200/60 text-center text-xs font-semibold uppercase tracking-wide text-base-content/60">
        {#each WEEKDAY_LABELS as label}
            <div class="px-2 py-2">{label}</div>
        {/each}
    </div>

    <div class="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
        {#each days as day (day.toISOString())}
            {@const daySessions = sessionsForDay(day)}
            {@const overflowCount = daySessions.length - MAX_VISIBLE_SESSIONS}
            <div
                    data-calendar-day={day.toISOString()}
                    class="day-cell group relative min-h-0 overflow-hidden border-b border-r border-base-300 p-2 transition-colors {day.getMonth() !== anchorMonth ? 'bg-base-200/40' : ''} {isDropTarget(day) ? 'bg-primary/10' : ''}"
            >
                {#if isToday(day) || isDropTarget(day)}
                    <div
                            class="pointer-events-none absolute inset-0 z-10 box-border border-2 border-primary"
                            aria-hidden="true"
                    ></div>
                {/if}
                <div class="mb-1 flex items-center justify-between gap-1">
                    <button
                            type="button"
                            class="text-sm font-semibold transition-colors {isToday(day) ? 'text-primary' : ''} {day.getMonth() !== anchorMonth ? 'text-base-content/50' : ''}"
                            onclick={() => onDayClick?.(day)}
                    >
                        {day.getDate()}
                    </button>

                    <button
                            type="button"
                            class="btn btn-ghost btn-xs opacity-0 transition-opacity group-hover:opacity-100"
                            title="Add session"
                            onclick={() => onCreateSession?.(day)}
                    >
                        +
                    </button>
                </div>

                <div class="flex flex-col gap-1">
                    {#each daySessions.slice(0, MAX_VISIBLE_SESSIONS) as session (session.id)}
                        <SessionBlock
                                {session}
                                {domains}
                                compact
                                dragging={draggingSessionId === session.id}
                                onclick={() => onSessionClick?.(session)}
                                onPointerDragStart={(event) => startSessionDrag(event, session)}
                        />
                    {/each}

                    {#if overflowCount > 0}
                        <button
                                type="button"
                                class="text-left text-xs text-base-content/60 hover:text-primary"
                                onclick={() => onDayClick?.(day)}
                        >
                            +{overflowCount} more
                        </button>
                    {/if}
                </div>
            </div>
        {/each}
    </div>
</div>
