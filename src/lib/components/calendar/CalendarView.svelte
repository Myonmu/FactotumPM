<script lang="ts">
    import { onMount } from 'svelte'
    import { ChevronLeft, ChevronRight, Plus } from 'lucide-svelte'

    import DayView from '$lib/components/calendar/DayView.svelte'
    import MonthView from '$lib/components/calendar/MonthView.svelte'
    import SessionEditor from '$lib/components/calendar/SessionEditor.svelte'
    import WeekView from '$lib/components/calendar/WeekView.svelte'
    import TableTab from '$lib/components/TableTab.svelte'
    import {
        addDays,
        addMonths,
        type CalendarViewMode,
        formatDayTitle,
        formatMonthYear,
        formatWeekRange,
        getMonthGrid,
        getWeekDays,
        startOfDay,
    } from '$lib/calendar/dates'
    import { loadDomainOptions, loadTaskOptions, type TaskRef } from '$lib/db/dataView'
    import {
        createDefaultSessionInput,
        createSession,
        deleteSession,
        loadSessions,
        sessionToInput,
        type SessionInput,
        type SessionRecord,
        updateSession,
    } from '$lib/db/sessions'
    import { closeInspector, openInspector, updateInspectorProps } from '$lib/inspector.svelte'

    let viewMode = $state<CalendarViewMode>('month')
    let anchorDate = $state(startOfDay(new Date()))
    let sessions = $state<SessionRecord[]>([])
    let taskOptions = $state<TaskRef[]>([])
    let domains = $state<{ id: string; title: string; color?: number | null }[]>([])
    let loading = $state(true)
    let saving = $state(false)
    let error = $state<string | null>(null)

    const SNAP_MINUTES_KEY = 'calendarSnapMinutes'
    const DEFAULT_SNAP_MINUTES = 15

    let snapMinutes = $state(DEFAULT_SNAP_MINUTES)

    const monthDays = $derived(getMonthGrid(anchorDate))
    const weekDays = $derived(getWeekDays(anchorDate))

    const headerTitle = $derived.by(() => {
        if (viewMode === 'month') return formatMonthYear(anchorDate)
        if (viewMode === 'week') return formatWeekRange(anchorDate)
        return formatDayTitle(anchorDate)
    })

    async function refreshSessions() {
        sessions = await loadSessions()
    }

    async function loadContext() {
        loading = true
        error = null

        try {
            taskOptions = await loadTaskOptions()
            domains = await loadDomainOptions()
            await refreshSessions()
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to load calendar data'
        } finally {
            loading = false
        }
    }

    function buildSessionInspectorProps(session: SessionInput, isSaving = saving) {
        return {
            session: { ...session },
            tasks: taskOptions,
            domains,
            saving: isSaving,
            onSave: handleSaveSession,
            onDelete: handleDeleteSession,
            onCancel: closeInspector,
        }
    }

    function sessionInspectorTitle(session: SessionInput): string {
        return session.id ? 'Session Inspector' : 'New Session'
    }

    function openSessionInspector(session: SessionInput, isSaving = saving) {
        openInspector(
            SessionEditor,
            buildSessionInspectorProps(session, isSaving),
            sessionInspectorTitle(session),
        )
    }

    function openNewSession(day: Date, hour = 9) {
        openSessionInspector(createDefaultSessionInput(day, hour))
    }

    function handleSessionClick(session: SessionRecord) {
        openSessionInspector(sessionToInput(session))
    }

    function handleDayClick(day: Date) {
        anchorDate = startOfDay(day)
        viewMode = 'day'
    }

    async function handleSaveSession(session: SessionInput) {
        saving = true
        updateInspectorProps({ saving: true })
        error = null

        try {
            if (session.id) {
                await updateSession(session)
                await refreshSessions()
                updateInspectorProps({ saving: false })
            } else {
                const created = await createSession(session)
                await refreshSessions()
                updateInspectorProps(
                    { session: sessionToInput(created), saving: false },
                    'Session Inspector',
                )
            }
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to save session'
            updateInspectorProps({ saving: false })
        } finally {
            saving = false
        }
    }

    async function handleDeleteSession(sessionId: string) {
        saving = true
        updateInspectorProps({ saving: true })
        error = null

        try {
            await deleteSession(sessionId)
            await refreshSessions()
            closeInspector()
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to delete session'
            updateInspectorProps({ saving: false })
        } finally {
            saving = false
        }
    }

    function clampSnapMinutes(value: number): number {
        return Math.max(1, Math.min(60, Math.round(value) || DEFAULT_SNAP_MINUTES))
    }

    function persistSnapMinutes() {
        snapMinutes = clampSnapMinutes(snapMinutes)
        sessionStorage.setItem(SNAP_MINUTES_KEY, String(snapMinutes))
    }

    async function handleSessionTimesChange(
        session: SessionRecord,
        started_at: string,
        ended_at: string,
    ) {
        error = null

        try {
            await updateSession({
                ...sessionToInput(session),
                started_at,
                ended_at,
            })
            await refreshSessions()
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to update session'
            throw err
        }
    }

    async function handleSessionDayChange(
        session: SessionRecord,
        _targetDay: Date,
        started_at: string,
        ended_at: string,
    ) {
        await handleSessionTimesChange(session, started_at, ended_at)
    }

    function goToday() {
        anchorDate = startOfDay(new Date())
    }

    function goPrevious() {
        if (viewMode === 'month') {
            anchorDate = addMonths(anchorDate, -1)
            return
        }

        if (viewMode === 'week') {
            anchorDate = addDays(anchorDate, -7)
            return
        }

        anchorDate = addDays(anchorDate, -1)
    }

    function goNext() {
        if (viewMode === 'month') {
            anchorDate = addMonths(anchorDate, 1)
            return
        }

        if (viewMode === 'week') {
            anchorDate = addDays(anchorDate, 7)
            return
        }

        anchorDate = addDays(anchorDate, 1)
    }

    onMount(() => {
        const stored = sessionStorage.getItem(SNAP_MINUTES_KEY)
        if (stored) {
            snapMinutes = clampSnapMinutes(Number(stored))
        }

        loadContext()
    })
</script>

<div class="flex h-full min-h-0 flex-col bg-base-200">
    <div class="sticky top-0 z-30 border-b border-base-300 bg-base-200/95 px-4 py-3 backdrop-blur">
        <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
                <h1 class="text-2xl font-bold">Calendar</h1>
                <p class="mt-1 text-sm text-base-content/60">
                    Plan sessions linked to tasks across month, week, and day views.
                </p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
                <span class="mr-1 text-sm font-semibold uppercase tracking-wide text-base-content/60">
                    View
                </span>
                <TableTab
                        label="Month"
                        active={viewMode === 'month'}
                        onclick={() => (viewMode = 'month')}
                />
                <TableTab
                        label="Week"
                        active={viewMode === 'week'}
                        onclick={() => (viewMode = 'week')}
                />
                <TableTab
                        label="Day"
                        active={viewMode === 'day'}
                        onclick={() => (viewMode = 'day')}
                />
            </div>
        </div>

        <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-2">
                <button
                        type="button"
                        class="btn btn-ghost btn-sm btn-square"
                        aria-label="Previous"
                        onclick={goPrevious}
                >
                    <ChevronLeft class="h-4 w-4" />
                </button>
                <button
                        type="button"
                        class="btn btn-ghost btn-sm"
                        onclick={goToday}
                >
                    Today
                </button>
                <button
                        type="button"
                        class="btn btn-ghost btn-sm btn-square"
                        aria-label="Next"
                        onclick={goNext}
                >
                    <ChevronRight class="h-4 w-4" />
                </button>
                <h2 class="text-lg font-semibold">{headerTitle}</h2>
            </div>

            <div class="flex flex-wrap items-center gap-3">
                {#if viewMode !== 'month'}
                    <label class="flex items-center gap-2 text-sm text-base-content/70">
                        <span class="font-medium">Snap</span>
                        <input
                                type="number"
                                min="1"
                                max="60"
                                class="input input-bordered input-xs w-16"
                                bind:value={snapMinutes}
                                onchange={persistSnapMinutes}
                        />
                        <span>min</span>
                    </label>
                {/if}

                <button
                        type="button"
                        class="btn btn-primary btn-sm"
                        onclick={() => openNewSession(anchorDate)}
                >
                    <Plus class="h-4 w-4" />
                    New session
                </button>
            </div>
        </div>
    </div>

    <div class="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
        {#if error}
            <div class="alert alert-error mb-4 shadow-sm">
                <span>{error}</span>
            </div>
        {/if}

        {#if loading}
            <div class="flex flex-1 items-center justify-center text-base-content/60">
                Loading calendar…
            </div>
        {:else if viewMode === 'month'}
            <MonthView
                    days={monthDays}
                    anchorMonth={anchorDate.getMonth()}
                    sessions={sessions}
                    onDayClick={handleDayClick}
                    onSessionClick={handleSessionClick}
                    onCreateSession={(day: Date) => openNewSession(day)}
                    onSessionDayChange={handleSessionDayChange}
            />
        {:else if viewMode === 'week'}
            <WeekView
                    days={weekDays}
                    sessions={sessions}
                    snapMinutes={snapMinutes}
                    onSessionClick={handleSessionClick}
                    onSlotClick={(day, hour) => openNewSession(day, hour)}
                    onDayHeaderClick={handleDayClick}
                    onSessionTimesChange={handleSessionTimesChange}
            />
        {:else}
            <DayView
                    day={anchorDate}
                    sessions={sessions}
                    snapMinutes={snapMinutes}
                    onSessionClick={handleSessionClick}
                    onSlotClick={(day, hour) => openNewSession(day, hour)}
                    onSessionTimesChange={handleSessionTimesChange}
            />
        {/if}
    </div>
</div>
