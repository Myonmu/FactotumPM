<script lang="ts">
    import { ChevronLeft, Plus } from 'lucide-svelte'

    import SessionRefCard from '$lib/components/SessionRefCard.svelte'
    import SessionEditor from '$lib/components/calendar/SessionEditor.svelte'
    import type { DomainOption, TaskRef } from '$lib/db/dataView'
    import {
        createSession,
        createSessionInputForTask,
        deleteSession,
        loadTaskSessionTimeline,
        sessionToInput,
        updateSession,
        type SessionInput,
        type SessionRecord,
        type TaskSessionTimeline,
    } from '$lib/db/sessions'

    let {
        taskId,
        tasks = [],
        domains = [],
        now = new Date(),
    }: {
        taskId: string
        tasks?: TaskRef[]
        domains?: DomainOption[]
        now?: Date
    } = $props()

    const emptyTimeline: TaskSessionTimeline = { lastSession: null, futureSessions: [] }

    let timeline = $state<TaskSessionTimeline>(emptyTimeline)
    let loading = $state(true)
    let saving = $state(false)
    let error = $state<string | null>(null)
    let editorSession = $state<SessionInput | null>(null)
    let lockTaskOnEditor = $state(false)
    let loadedForTaskId = $state<string | null>(null)
    let refreshGeneration = 0

    async function refreshTimeline(options: { silent?: boolean } = {}) {
        const silent = options.silent ?? loadedForTaskId === taskId
        const generation = ++refreshGeneration

        if (!silent) {
            loading = true
        }

        error = null

        try {
            const nextTimeline = await loadTaskSessionTimeline(taskId)
            if (generation !== refreshGeneration) return
            timeline = nextTimeline
            loadedForTaskId = taskId
        } catch (err) {
            if (generation !== refreshGeneration) return
            error = err instanceof Error ? err.message : 'Failed to load sessions'
        } finally {
            if (generation === refreshGeneration && !silent) {
                loading = false
            }
        }
    }

    function openNewSession() {
        editorSession = createSessionInputForTask(taskId)
        lockTaskOnEditor = true
    }

    function openExistingSession(session: SessionRecord) {
        editorSession = sessionToInput(session)
        lockTaskOnEditor = false
    }

    function closeEditor() {
        const wasEditing = editorSession != null
        editorSession = null
        lockTaskOnEditor = false

        if (wasEditing) {
            void refreshTimeline({ silent: true })
        }
    }

    async function handleSaveSession(session: SessionInput) {
        saving = true
        error = null

        try {
            if (session.id) {
                await updateSession(session)
            } else {
                const created = await createSession(session)
                editorSession = sessionToInput(created)
                lockTaskOnEditor = false
                await refreshTimeline({ silent: true })
            }
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to save session'
        } finally {
            saving = false
        }
    }

    async function handleDeleteSession(sessionId: string) {
        saving = true
        error = null

        try {
            await deleteSession(sessionId)
            editorSession = null
            lockTaskOnEditor = false
            await refreshTimeline({ silent: true })
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to delete session'
        } finally {
            saving = false
        }
    }

    $effect(() => {
        if (taskId === loadedForTaskId && loadedForTaskId != null) return

        refreshGeneration += 1
        editorSession = null
        lockTaskOnEditor = false
        timeline = emptyTimeline
        void refreshTimeline()
    })
</script>

<div class="space-y-4">
    {#if error}
        <div class="alert alert-error py-2 text-sm">
            <span>{error}</span>
        </div>
    {/if}

    {#if editorSession}
        <div class="space-y-3">
            <button
                    type="button"
                    class="btn btn-ghost btn-sm gap-1"
                    onclick={closeEditor}
                    disabled={saving}
            >
                <ChevronLeft class="h-4 w-4" />
                Back to sessions
            </button>

            <SessionEditor
                    embedded
                    lockedTaskId={lockTaskOnEditor ? taskId : undefined}
                    session={editorSession}
                    {tasks}
                    {domains}
                    {saving}
                    onSave={handleSaveSession}
                    onDelete={handleDeleteSession}
                    onCancel={closeEditor}
            />
        </div>
    {:else if loading}
        <div class="py-6 text-center text-sm text-base-content/60">Loading sessions…</div>
    {:else}
        <section class="space-y-2">
            <h3 class="text-sm font-medium">Last session</h3>
            {#if timeline.lastSession}
                <SessionRefCard
                        session={timeline.lastSession}
                        {domains}
                        {now}
                        class="w-full"
                        onclick={() => openExistingSession(timeline.lastSession!)}
                />
            {:else}
                <p class="rounded-lg border border-dashed border-base-300 px-3 py-4 text-sm text-base-content/50">
                    No completed sessions yet.
                </p>
            {/if}
        </section>

        <section class="space-y-2">
            <div class="flex items-center justify-between gap-2">
                <h3 class="text-sm font-medium">Upcoming sessions</h3>
                <button
                        type="button"
                        class="btn btn-ghost btn-sm gap-1"
                        onclick={openNewSession}
                >
                    <Plus class="h-4 w-4" />
                    New session
                </button>
            </div>

            {#if timeline.futureSessions.length === 0}
                <p class="rounded-lg border border-dashed border-base-300 px-3 py-4 text-sm text-base-content/50">
                    No upcoming sessions scheduled.
                </p>
            {:else}
                <ul class="space-y-2">
                    {#each timeline.futureSessions as session (session.id)}
                        <li>
                            <SessionRefCard
                                    {session}
                                    {domains}
                                    {now}
                                    class="w-full"
                                    onclick={() => openExistingSession(session)}
                            />
                        </li>
                    {/each}
                </ul>
            {/if}
        </section>
    {/if}
</div>
