<script lang="ts">
    import FullCalendarTimeGrid from '$lib/components/calendar/FullCalendarTimeGrid.svelte'
    import type { SessionRecord } from '$lib/db/sessions'

    let {
        day,
        sessions = [],
        snapMinutes = 15,
        onSessionClick,
        onSlotClick,
        onSessionTimesChange,
    }: {
        day: Date
        sessions?: SessionRecord[]
        snapMinutes?: number
        onSessionClick?: (session: SessionRecord) => void
        onSlotClick?: (day: Date, hour: number) => void
        onSessionTimesChange?: (
            session: SessionRecord,
            started_at: string,
            ended_at: string,
        ) => void | Promise<void>
    } = $props()
</script>

<FullCalendarTimeGrid
        view="day"
        anchorDate={day}
        sessions={sessions}
        snapMinutes={snapMinutes}
        onSessionClick={onSessionClick}
        onSlotClick={onSlotClick}
        onSessionTimesChange={onSessionTimesChange}
/>
