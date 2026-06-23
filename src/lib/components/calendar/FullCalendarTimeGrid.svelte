<script lang="ts">
    import { onMount } from 'svelte'
    import { Calendar } from '@fullcalendar/core'
    import type { Calendar as CalendarInstance } from '@fullcalendar/core'
    import type { EventDropArg } from '@fullcalendar/core'
    import type { EventResizeDoneArg } from '@fullcalendar/interaction'
    import interactionPlugin from '@fullcalendar/interaction'
    import timeGridPlugin from '@fullcalendar/timegrid'

    import { startOfDay } from '$lib/calendar/dates'
    import {
        fullCalendarRangeToSqlTimestamps,
        sessionsToFullCalendarEvents,
    } from '$lib/calendar/fullCalendarSessions'
    import type { SessionRecord } from '$lib/db/sessions'

    let {
        view = 'week',
        anchorDate,
        sessions = [],
        snapMinutes = 15,
        onSessionClick,
        onSlotClick,
        onDayHeaderClick,
        onSessionTimesChange,
    }: {
        view?: 'week' | 'day'
        anchorDate: Date
        sessions?: SessionRecord[]
        snapMinutes?: number
        onSessionClick?: (session: SessionRecord) => void
        onSlotClick?: (day: Date, hour: number) => void
        onDayHeaderClick?: (day: Date) => void
        onSessionTimesChange?: (
            session: SessionRecord,
            started_at: string,
            ended_at: string,
        ) => void | Promise<void>
    } = $props()

    let host = $state<HTMLElement | null>(null)
    let gridHost = $state<HTMLElement | null>(null)
    let calendar = $state<CalendarInstance | null>(null)

    let syncedViewName = $state<string | null>(null)
    let syncedAnchorMs = $state<number | null>(null)
    let sizeRefreshFrame = 0

    const viewName = $derived(view === 'week' ? 'timeGridWeek' : 'timeGridDay')

    function refreshCalendarSize() {
        if (!calendar || !host) return

        cancelAnimationFrame(sizeRefreshFrame)
        sizeRefreshFrame = requestAnimationFrame(() => {
            sizeRefreshFrame = requestAnimationFrame(() => {
                if (!calendar || !host) return

                const height = host.clientHeight
                if (height > 0) {
                    calendar.setOption('height', height)
                }

                calendar.updateSize()
            })
        })
    }

    function getScrollEl(): HTMLElement | null {
        if (!host) return null

        return host.querySelector('.fc-scroller-liquid-absolute, .fc-scroller')
    }

    function preserveScroll(update: () => void) {
        const scroller = getScrollEl()
        const scrollTop = scroller?.scrollTop ?? 0

        update()

        if (scroller) {
            requestAnimationFrame(() => {
                scroller.scrollTop = scrollTop
            })
        }
    }

    function pinScrollPosition() {
        const scroller = getScrollEl()
        if (!scroller) return

        const scrollTop = scroller.scrollTop
        requestAnimationFrame(() => {
            scroller.scrollTop = scrollTop
            requestAnimationFrame(() => {
                scroller.scrollTop = scrollTop
            })
        })
    }

    async function commitEventChange(
        info: EventDropArg | EventResizeDoneArg,
    ): Promise<void> {
        const session = info.event.extendedProps.session as SessionRecord | undefined
        const start = info.event.start
        const end = info.event.end

        if (!session || !start || !end) {
            info.revert()
            return
        }

        const { started_at, ended_at } = fullCalendarRangeToSqlTimestamps(start, end)

        try {
            await onSessionTimesChange?.(session, started_at, ended_at)
        } catch {
            info.revert()
        }
    }

    function syncSnapOptions() {
        if (!calendar) return

        calendar.setOption('snapDuration', { minutes: snapMinutes })
        calendar.setOption('slotDuration', { minutes: snapMinutes })
        refreshCalendarSize()
    }

    function syncEvents() {
        if (!calendar) return

        preserveScroll(() => {
            calendar!.setOption('events', sessionsToFullCalendarEvents(sessions))
        })
    }

    function syncNavigation() {
        if (!calendar) return

        const anchorMs = startOfDay(anchorDate).getTime()

        if (syncedViewName !== viewName) {
            calendar.changeView(viewName, anchorDate)
            syncedViewName = viewName
            syncedAnchorMs = anchorMs
            refreshCalendarSize()
            return
        }

        if (syncedAnchorMs !== anchorMs) {
            calendar.gotoDate(anchorDate)
            syncedAnchorMs = anchorMs
            refreshCalendarSize()
        }
    }

    function handleGridClick(event: MouseEvent) {
        if (view !== 'week' || !onDayHeaderClick) return

        const header = (event.target as Element).closest('.fc-col-header-cell[data-date]')
        if (!header || !host?.contains(header)) return

        const dateStr = header.getAttribute('data-date')
        if (!dateStr) return

        const [year, month, day] = dateStr.split('-').map(Number)
        onDayHeaderClick(startOfDay(new Date(year, month - 1, day)))
    }

    onMount(() => {
        if (!host) return

        const instance = new Calendar(host, {
            plugins: [timeGridPlugin, interactionPlugin],
            initialView: view === 'week' ? 'timeGridWeek' : 'timeGridDay',
            initialDate: anchorDate,
            headerToolbar: false,
            firstDay: 1,
            timeZone: 'local',
            allDaySlot: false,
            editable: true,
            eventStartEditable: true,
            eventDurationEditable: true,
            eventResizableFromStart: true,
            snapDuration: { minutes: snapMinutes },
            slotDuration: { minutes: snapMinutes },
            height: '100%',
            expandRows: true,
            nowIndicator: true,
            fixedMirrorParent: document.body,
            events: sessionsToFullCalendarEvents(sessions),
            eventClick: (info) => {
                const session = info.event.extendedProps.session as SessionRecord | undefined
                if (session) onSessionClick?.(session)
            },
            dateClick: (info) => {
                onSlotClick?.(info.date, info.date.getHours())
            },
            eventDragStop: () => {
                pinScrollPosition()
            },
            eventResizeStop: () => {
                pinScrollPosition()
            },
            eventDrop: (info) => {
                pinScrollPosition()
                void commitEventChange(info)
            },
            eventResize: (info) => {
                pinScrollPosition()
                void commitEventChange(info)
            },
        })

        instance.render()
        calendar = instance
        syncedViewName = viewName
        syncedAnchorMs = startOfDay(anchorDate).getTime()

        refreshCalendarSize()

        const resizeObserver = new ResizeObserver(() => {
            refreshCalendarSize()
        })

        if (host) {
            resizeObserver.observe(host)
        }

        if (gridHost && gridHost !== host) {
            resizeObserver.observe(gridHost)
        }

        const handleWindowResize = () => {
            refreshCalendarSize()
        }

        window.addEventListener('resize', handleWindowResize)

        return () => {
            cancelAnimationFrame(sizeRefreshFrame)
            resizeObserver.disconnect()
            window.removeEventListener('resize', handleWindowResize)
            instance.destroy()
            calendar = null
            syncedViewName = null
            syncedAnchorMs = null
        }
    })

    $effect(() => {
        snapMinutes
        syncSnapOptions()
    })

    $effect(() => {
        sessions
        syncEvents()
    })

    $effect(() => {
        view
        anchorDate
        syncNavigation()
    })
</script>

<div
        bind:this={gridHost}
        class="fc-time-grid-host h-full min-h-0 flex-1 overflow-hidden rounded-box border border-base-300 bg-base-100"
        onclick={handleGridClick}
>
    <div bind:this={host} class="h-full min-h-0"></div>
</div>

<style>
    .fc-time-grid-host :global(.fc) {
        --fc-border-color: oklch(var(--b3) / 1);
        --fc-page-bg-color: oklch(var(--b1) / 1);
        --fc-neutral-bg-color: oklch(var(--b2) / 1);
        --fc-today-bg-color: oklch(var(--p) / 0.08);
        --fc-now-indicator-color: oklch(var(--p) / 1);
        --fc-event-border-color: oklch(var(--p) / 1);
        --fc-highlight-color: oklch(var(--p) / 0.12);
        font-family: inherit;
    }

    .fc-time-grid-host :global(.fc-timegrid-slot-label-cushion),
    .fc-time-grid-host :global(.fc-col-header-cell-cushion) {
        color: oklch(var(--bc) / 0.65);
        font-size: 0.75rem;
        font-weight: 600;
    }

    .fc-time-grid-host :global(.fc-col-header-cell-cushion) {
        color: oklch(var(--bc) / 1);
        font-size: 0.875rem;
    }

    .fc-time-grid-host :global(.fc-timeGridWeek-view .fc-col-header-cell) {
        cursor: pointer;
    }

    .fc-time-grid-host :global(.fc-timeGridWeek-view .fc-col-header-cell:hover .fc-col-header-cell-cushion) {
        color: oklch(var(--p) / 1);
    }

    .fc-time-grid-host :global(.fc-timegrid-now-indicator-line) {
        border-width: 2px;
    }

    .fc-time-grid-host :global(.fc-event) {
        border-radius: 0.375rem;
        padding: 0.125rem 0.25rem;
        font-size: 0.75rem;
        cursor: grab;
    }

    .fc-time-grid-host :global(.fc-event:active) {
        cursor: grabbing;
    }

    .fc-time-grid-host :global(.fc-event-title) {
        font-weight: 600;
    }

    .fc-time-grid-host :global(.fc-event.fc-session-evaluated) {
        opacity: 0.5;
    }
</style>
