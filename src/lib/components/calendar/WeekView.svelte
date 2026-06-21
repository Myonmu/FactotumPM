<script lang="ts">
    import FullCalendarTimeGrid from '$lib/components/calendar/FullCalendarTimeGrid.svelte'
    import type { SessionRecord } from '$lib/db/sessions'

    let {
        days,
        sessions = [],
        snapMinutes = 15,
        onSessionClick,
        onSlotClick,
        onDayHeaderClick,
        onSessionTimesChange,
    }: {
        days: Date[]
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

    const anchorDate = $derived(days[0] ?? new Date())
</script>

<FullCalendarTimeGrid
        view="week"
        anchorDate={anchorDate}
        sessions={sessions}
        snapMinutes={snapMinutes}
        onSessionClick={onSessionClick}
        onSlotClick={onSlotClick}
        onDayHeaderClick={onDayHeaderClick}
        onSessionTimesChange={onSessionTimesChange}
/>
