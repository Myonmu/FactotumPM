<script lang="ts">
    import TaskSearchableSelect from '$lib/components/TaskSearchableSelect.svelte'
    import DateTimeField from '$lib/components/DateTimeField.svelte'
    import { formatSqlTimestamp, parseSqlTimestamp } from '$lib/calendar/dates'
    import type { DomainOption, TaskRef } from '$lib/db/dataView'
    import { getSessionDisplayTitle, type SessionInput } from '$lib/db/sessions'
    import { Plus, Trash2, X } from 'lucide-svelte'

    let {
        session,
        tasks = [],
        domains = [],
        saving = false,
        embedded = false,
        lockedTaskId,
        onSave,
        onDelete,
        onCancel,
    }: {
        session: SessionInput
        tasks?: TaskRef[]
        domains?: DomainOption[]
        saving?: boolean
        embedded?: boolean
        lockedTaskId?: string
        onSave?: (session: SessionInput) => void | Promise<void>
        onDelete?: (sessionId: string) => void | Promise<void>
        onCancel?: () => void
    } = $props()

    let localSession = $state<SessionInput>({ ...session, task_ids: [...session.task_ids] })
    let showDeleteConfirm = $state(false)
    let deleting = $state(false)
    let skipAutoSave = $state(true)
    let saveTimer: ReturnType<typeof setTimeout> | undefined
    let loadedSessionKey = $state<string | null>(null)
    let lastPersistedSnapshot = $state('')
    let taskIds = $state<string[]>(session.task_ids.length > 0 ? [...session.task_ids] : [''])

    let startedAt = $state<Date | null>(parseSqlTimestamp(session.started_at))
    let endedAt = $state<Date | null>(parseSqlTimestamp(session.ended_at))

    const sessionLabel = $derived(
        getSessionDisplayTitle({
            tasks: taskIds
                .filter(Boolean)
                .map((id) => ({
                    id,
                    title: tasks.find((task) => task.id === id)?.title ?? 'Untitled task',
                    color: null,
                })),
            task_title: null,
        }),
    )

    const canDelete = $derived(Boolean(localSession.id && onDelete))
    const isNewSession = $derived(!localSession.id)
    const canPersist = $derived(
        lockedTaskId != null || taskIds.some((taskId) => taskId.trim().length > 0),
    )

    function sessionKey(value: SessionInput): string {
        return value.id ?? '__draft__'
    }

    function toSqlTimestamp(value: Date | null): string {
        return value ? formatSqlTimestamp(value) : formatSqlTimestamp(new Date())
    }

    function buildPayload(): SessionInput {
        const resolvedTaskIds =
            lockedTaskId != null
                ? [
                      lockedTaskId,
                      ...taskIds.filter(
                          (taskId) => taskId.trim().length > 0 && taskId !== lockedTaskId,
                      ),
                  ]
                : taskIds.filter((taskId) => taskId.trim().length > 0)

        return {
            ...localSession,
            task_ids: resolvedTaskIds,
            started_at: toSqlTimestamp(startedAt),
            ended_at: toSqlTimestamp(endedAt),
        }
    }

    function payloadSnapshot(): string {
        return JSON.stringify(buildPayload())
    }

    function applySessionFromProps() {
        localSession = { ...session, task_ids: [...session.task_ids] }
        taskIds =
            lockedTaskId != null
                ? [lockedTaskId]
                : session.task_ids.length > 0
                  ? [...session.task_ids]
                  : ['']
        startedAt = parseSqlTimestamp(session.started_at)
        endedAt = parseSqlTimestamp(session.ended_at)
        skipAutoSave = true
        lastPersistedSnapshot = payloadSnapshot()
    }

    $effect(() => {
        const nextKey = sessionKey(session)
        if (nextKey === loadedSessionKey) return

        loadedSessionKey = nextKey
        applySessionFromProps()
    })

    $effect(() => {
        if (lockedTaskId || !localSession.id || canPersist || session.task_ids.length === 0) return

        taskIds = [...session.task_ids]
        skipAutoSave = true
        lastPersistedSnapshot = payloadSnapshot()
    })

    async function persist() {
        if (!onSave || !canPersist || showDeleteConfirm || deleting) return

        const snapshot = payloadSnapshot()
        if (snapshot === lastPersistedSnapshot) return

        await onSave(buildPayload())
        lastPersistedSnapshot = snapshot
    }

    function addTaskRow() {
        taskIds = [...taskIds, '']
    }

    function removeTaskRow(index: number) {
        if (taskIds.length <= 1) {
            taskIds = ['']
            return
        }

        taskIds = taskIds.filter((_, rowIndex) => rowIndex !== index)
    }

    async function confirmDelete() {
        if (!localSession.id || !onDelete || deleting) return

        deleting = true

        try {
            await onDelete(localSession.id)
            showDeleteConfirm = false
        } finally {
            deleting = false
        }
    }

    async function handleCreate() {
        if (!onSave || !canPersist || saving || deleting) return
        clearTimeout(saveTimer)
        await persist()
    }

    $effect(() => {
        if (!onSave || !canPersist || isNewSession || showDeleteConfirm || deleting) return

        const _snapshot = payloadSnapshot()

        if (skipAutoSave) {
            skipAutoSave = false
            return
        }

        clearTimeout(saveTimer)
        saveTimer = setTimeout(() => {
            void persist()
        }, 400)

        return () => {
            clearTimeout(saveTimer)
        }
    })
</script>

<div
        class="border bg-base-100"
        class:card={!embedded}
        class:shadow-xl={!embedded}
        class:border-base-200={!embedded}
        class:rounded-lg={embedded}
        class:border-base-300={embedded}
        class:p-4={embedded}
>
    <div class="flex flex-col gap-4" class:card-body={!embedded}>
        {#if !embedded}
            <div>
                <h2 class="text-lg font-semibold">
                    {localSession.id ? 'Edit session' : 'New session'}
                </h2>
                <p class="mt-1 text-sm text-base-content/60">
                    {#if isNewSession}
                        {#if canPersist}
                            Set the details below, then create the session.
                        {:else}
                            Select at least one task to create this session.
                        {/if}
                    {:else}
                        Changes save automatically.
                    {/if}
                </p>
            </div>
        {:else}
            <p class="text-sm text-base-content/60">
                {#if isNewSession}
                    {#if canPersist}
                        Set the details below, then create the session.
                    {:else}
                        Select at least one task to create this session.
                    {/if}
                {:else}
                    Changes save automatically.
                {/if}
            </p>
        {/if}

        {#if lockedTaskId == null}
            <div class="flex flex-col gap-2">
                <span class="text-sm font-medium">Tasks</span>
                {#each taskIds as taskId, index (index)}
                    <div class="flex items-end gap-2">
                        <div class="min-w-0 flex-1">
                            <TaskSearchableSelect
                                    label={index === 0 ? 'Task' : `Task ${index + 1}`}
                                    {tasks}
                                    {domains}
                                    bind:value={taskIds[index]}
                                    placeholder="Select a task"
                                    group="session-inspector-{index}"
                            />
                        </div>
                        <button
                                type="button"
                                class="btn btn-ghost btn-square btn-sm shrink-0"
                                title="Remove task"
                                aria-label="Remove task"
                                disabled={taskIds.length <= 1 && !taskIds[0]}
                                onclick={() => removeTaskRow(index)}
                        >
                            <X class="h-4 w-4" />
                        </button>
                    </div>
                {/each}

                <button
                        type="button"
                        class="btn btn-ghost btn-sm gap-2 self-start"
                        onclick={addTaskRow}
                >
                    <Plus class="h-4 w-4" />
                    Add task
                </button>
            </div>
        {/if}

        <div class="grid gap-3 sm:grid-cols-2">
            <DateTimeField label="Start" bind:value={startedAt} />
            <DateTimeField label="End" bind:value={endedAt} />
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2">
            {#if isNewSession}
                <span></span>
                <div class="flex items-center gap-2">
                    {#if onCancel}
                        <button
                                type="button"
                                class="btn btn-ghost btn-sm"
                                onclick={onCancel}
                                disabled={saving || deleting}
                        >
                            Cancel
                        </button>
                    {/if}
                    <button
                            type="button"
                            class="btn btn-primary btn-sm"
                            onclick={handleCreate}
                            disabled={saving || deleting || !canPersist}
                    >
                        {saving ? 'Creating…' : 'Create session'}
                    </button>
                </div>
            {:else}
                {#if canDelete}
                    <button
                            type="button"
                            class="btn btn-error btn-outline btn-sm gap-2"
                            onclick={() => (showDeleteConfirm = true)}
                            disabled={saving || deleting}
                    >
                        <Trash2 class="h-4 w-4" />
                        Delete session
                    </button>
                {:else}
                    <span></span>
                {/if}

                {#if saving}
                    <span class="text-sm text-base-content/60">Saving…</span>
                {/if}
            {/if}
        </div>
    </div>
</div>

{#if showDeleteConfirm}
    <dialog class="modal modal-open">
        <div class="modal-box">
            <h3 class="text-lg font-bold">Delete session?</h3>
            <p class="py-4 text-base-content/70">
                This removes the session for
                <span class="font-semibold">{sessionLabel}</span>.
                The linked tasks will not be deleted.
            </p>
            <div class="modal-action">
                <button
                        type="button"
                        class="btn btn-ghost"
                        disabled={deleting}
                        onclick={() => (showDeleteConfirm = false)}
                >
                    Cancel
                </button>
                <button
                        type="button"
                        class="btn btn-error"
                        disabled={deleting}
                        onclick={confirmDelete}
                >
                    {deleting ? 'Deleting…' : 'Delete session'}
                </button>
            </div>
        </div>
        <form method="dialog" class="modal-backdrop">
            <button type="button" disabled={deleting} onclick={() => (showDeleteConfirm = false)}>
                close
            </button>
        </form>
    </dialog>
{/if}
