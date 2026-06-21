<script lang="ts">
    import SessionWithTask from '$lib/components/dashboard/SessionWithTask.svelte'
    import {
        deleteSession,
        finishSession,
        startSession,
        type SessionRecord,
    } from '$lib/db/sessions'
    import { openAftermathView } from '$lib/dashboard/dashboardNav.svelte'
    import {
        findActiveStartedSession,
        findOverlappingPlannedSession,
        getMissedPlannedSessions,
        getNonEvaluatedSessions,
        getPastDuePlannedSessions,
        getUpcomingPlannedSessions,
        type UpcomingSessionRange,
    } from '$lib/dashboard/sessionUtils'

    const UPCOMING_RANGE_OPTIONS: { id: UpcomingSessionRange; label: string }[] = [
        { id: 'today', label: 'Today' },
        { id: 'tomorrow', label: 'Tomorrow' },
        { id: 'week', label: 'This week' },
        { id: 'month', label: 'This month' },
    ]

    const UPCOMING_EMPTY_MESSAGES: Record<UpcomingSessionRange, string> = {
        today: 'No planned sessions for today.',
        tomorrow: 'No planned sessions for tomorrow.',
        week: 'No planned sessions this week.',
        month: 'No planned sessions this month.',
    }

    let {
        sessions,
        now,
        onSessionsChange,
    }: {
        sessions: SessionRecord[]
        now: Date
        onSessionsChange?: () => void | Promise<void>
    } = $props()

    let actionLoading = $state(false)
    let error = $state<string | null>(null)
    let upcomingRange = $state<UpcomingSessionRange>('today')

    const activeStartedSession = $derived(findActiveStartedSession(sessions, now))
    const overlappingPlannedSession = $derived(
        activeStartedSession ? null : findOverlappingPlannedSession(sessions, now),
    )
    const pastDuePlannedSessions = $derived(getPastDuePlannedSessions(sessions, now))
    const missedPlannedSessions = $derived(getMissedPlannedSessions(sessions, now))
    const upcomingPlannedSessions = $derived(
        getUpcomingPlannedSessions(sessions, now, upcomingRange, {
            excludeSessionIds: overlappingPlannedSession ? [overlappingPlannedSession.id] : [],
        }),
    )
    const nonEvaluatedSessions = $derived(getNonEvaluatedSessions(sessions))

    async function reloadSessions() {
        await onSessionsChange?.()
    }

    async function handleStart(sessionId: string) {
        if (actionLoading) return

        actionLoading = true
        error = null

        try {
            await startSession(sessionId, new Date())
            await reloadSessions()
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to start session'
        } finally {
            actionLoading = false
        }
    }

    async function handleCancel(sessionId: string) {
        if (actionLoading) return

        actionLoading = true
        error = null

        try {
            await deleteSession(sessionId)
            await reloadSessions()
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to cancel session'
        } finally {
            actionLoading = false
        }
    }

    async function handleFinish(sessionId: string) {
        if (actionLoading) return

        actionLoading = true
        error = null

        try {
            await finishSession(sessionId)
            await reloadSessions()
            openAftermathView(sessionId)
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to finish session'
        } finally {
            actionLoading = false
        }
    }

    function handleEvaluate(sessionId: string) {
        openAftermathView(sessionId)
    }
</script>

<div class="flex flex-col divide-y divide-base-300">
    {#if error}
        <div class="py-8">
            <div class="alert alert-error text-sm">
                <span>{error}</span>
            </div>
        </div>
    {/if}

    {#if activeStartedSession}
        <section class="py-8">
            <h2 class="mb-3 text-xl font-semibold">Current</h2>
            <SessionWithTask session={activeStartedSession} {now}>
                {#snippet actions()}
                    <button
                            type="button"
                            class="btn btn-primary btn-sm"
                            disabled={actionLoading}
                            onclick={() => void handleFinish(activeStartedSession.id)}
                    >
                        Finish session
                    </button>
                {/snippet}
            </SessionWithTask>
        </section>
    {/if}

    {#if pastDuePlannedSessions.length > 0}
        <section class="py-8">
            <h2 class="mb-3 text-xl font-semibold">Past due</h2>
            <p class="mb-3 text-sm text-base-content/60">
                Today's planned sessions that ended without being started.
            </p>
            <div class="flex flex-col gap-4">
                {#each pastDuePlannedSessions as session (session.id)}
                    <SessionWithTask {session} {now} showTasks>
                        {#snippet actions()}
                            <button
                                    type="button"
                                    class="btn btn-primary btn-sm"
                                    disabled={actionLoading}
                                    onclick={() => void handleStart(session.id)}
                            >
                                Start session
                            </button>
                            <button
                                    type="button"
                                    class="btn btn-ghost btn-sm"
                                    disabled={actionLoading}
                                    onclick={() => void handleCancel(session.id)}
                            >
                                Cancel session
                            </button>
                        {/snippet}
                    </SessionWithTask>
                {/each}
            </div>
        </section>
    {/if}

    <section class="py-8">
        <div class="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 class="text-xl font-semibold">Upcoming</h2>
            <div role="tablist" class="tabs tabs-boxed w-fit">
                {#each UPCOMING_RANGE_OPTIONS as option (option.id)}
                    <button
                            type="button"
                            role="tab"
                            class="tab tab-sm"
                            class:tab-active={upcomingRange === option.id}
                            aria-selected={upcomingRange === option.id}
                            onclick={() => {
                                upcomingRange = option.id
                            }}
                    >
                        {option.label}
                    </button>
                {/each}
            </div>
        </div>

        {#if upcomingRange === 'today' && !activeStartedSession && !overlappingPlannedSession}
            <p class="mb-4 text-base-content/70">Nothing is going on at the moment.</p>
        {/if}

        {#if upcomingRange === 'today' && overlappingPlannedSession}
            <div class="alert alert-warning mb-4">
                <div class="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div class="min-w-0 flex-1">
                        <p class="font-semibold">A planned session is happening now</p>
                        <SessionWithTask session={overlappingPlannedSession} {now} compact />
                    </div>
                    <div class="flex shrink-0 flex-col gap-2">
                        <button
                                type="button"
                                class="btn btn-primary btn-sm"
                                disabled={actionLoading}
                                onclick={() => void handleStart(overlappingPlannedSession.id)}
                        >
                            Start session
                        </button>
                        <button
                                type="button"
                                class="btn btn-ghost btn-sm"
                                disabled={actionLoading}
                                onclick={() => void handleCancel(overlappingPlannedSession.id)}
                        >
                            Cancel session
                        </button>
                    </div>
                </div>
            </div>
        {/if}

        {#if upcomingPlannedSessions.length > 0}
            <div class="flex flex-col gap-4">
                {#each upcomingPlannedSessions as session (session.id)}
                    <SessionWithTask {session} {now} showTasks>
                        {#snippet actions()}
                            <button
                                    type="button"
                                    class="btn btn-primary btn-sm"
                                    disabled={actionLoading}
                                    onclick={() => void handleStart(session.id)}
                            >
                                Start session
                            </button>
                            <button
                                    type="button"
                                    class="btn btn-ghost btn-sm"
                                    disabled={actionLoading}
                                    onclick={() => void handleCancel(session.id)}
                            >
                                Cancel session
                            </button>
                        {/snippet}
                    </SessionWithTask>
                {/each}
            </div>
        {:else if upcomingRange !== 'today' || !overlappingPlannedSession}
            <p class="text-base-content/60">{UPCOMING_EMPTY_MESSAGES[upcomingRange]}</p>
        {/if}
    </section>

    {#if nonEvaluatedSessions.length > 0}
        <section class="py-8">
            <h2 class="mb-1 text-xl font-semibold">Non-evaluated sessions</h2>
            <p class="mb-3 text-sm text-base-content/60">
                These finished sessions still need an aftermath.
            </p>
            <div class="flex flex-col gap-3">
                {#each nonEvaluatedSessions as session (session.id)}
                    <SessionWithTask {session} {now} showStatus>
                        {#snippet actions()}
                            <button
                                    type="button"
                                    class="btn btn-outline btn-sm"
                                    onclick={() => handleEvaluate(session.id)}
                            >
                                Evaluate
                            </button>
                        {/snippet}
                    </SessionWithTask>
                {/each}
            </div>
        </section>
    {/if}

    {#if missedPlannedSessions.length > 0}
        <section class="py-8">
            <h2 class="mb-3 text-xl font-semibold">Missed sessions</h2>
            <p class="mb-3 text-sm text-base-content/60">
                Older planned sessions that ended without being started.
            </p>
            <div class="flex flex-col gap-4">
                {#each missedPlannedSessions as session (session.id)}
                    <SessionWithTask {session} {now} showTasks>
                        {#snippet actions()}
                            <button
                                    type="button"
                                    class="btn btn-primary btn-sm"
                                    disabled={actionLoading}
                                    onclick={() => void handleStart(session.id)}
                            >
                                Start session
                            </button>
                            <button
                                    type="button"
                                    class="btn btn-ghost btn-sm"
                                    disabled={actionLoading}
                                    onclick={() => void handleCancel(session.id)}
                            >
                                Cancel session
                            </button>
                        {/snippet}
                    </SessionWithTask>
                {/each}
            </div>
        </section>
    {/if}
</div>
