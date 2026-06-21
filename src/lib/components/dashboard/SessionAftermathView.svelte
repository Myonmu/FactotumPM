<script lang="ts">
    import { onMount } from 'svelte'

    import AftermathSearchableSelect from '$lib/components/dashboard/AftermathSearchableSelect.svelte'
    import GraphKanbanBoard from '$lib/components/kanban/GraphKanbanBoard.svelte'
    import SessionWithTask from '$lib/components/dashboard/SessionWithTask.svelte'
    import IconPickerPopover from '$lib/components/IconPickerPopover.svelte'
    import LucideIcon from '$lib/components/LucideIcon.svelte'
    import {
        createAftermath,
        linkAftermathToSession,
        loadAftermathOptions,
        type AftermathOption,
    } from '$lib/db/aftermath'
    import {
        markPlannedSessionsNoLongerNeededAfter,
        type SessionRecord,
    } from '$lib/db/sessions'
    import { getSessionTaskIds } from '$lib/dashboard/sessionUtils'
    import {
        isTerminalStatus,
        loadTaskStatusMachine,
    } from '$lib/db/taskStatusMachine'
    import { returnToDashboardMain } from '$lib/dashboard/dashboardNav.svelte'
    import { colorHexToInt, mixDisplayColorInt } from '$lib/grid/colorUtils'

    type AftermathMode = 'existing' | 'new'

    let {
        session,
        onComplete,
        onSkip,
    }: {
        session: SessionRecord
        onComplete?: () => void | Promise<void>
        onSkip?: () => void | Promise<void>
    } = $props()

    let mode = $state<AftermathMode>('existing')
    let aftermathOptions = $state<AftermathOption[]>([])
    let selectedAftermathId = $state('')
    let score = $state(3)
    let description = $state('')
    let icon = $state<string | null>('smile')
    let colorHex = $state('#808080')
    let updateTaskStatus = $state(false)
    let saving = $state(false)
    let loading = $state(true)
    let error = $state<string | null>(null)
    let iconPickerAnchor = $state<{
        top: number
        left: number
        width: number
        height: number
    } | null>(null)
    let iconButtonEl = $state<HTMLButtonElement | null>(null)

    const taskFilterIds = $derived(getSessionTaskIds(session))
    const sessionTaskIds = $derived(new Set(taskFilterIds))
    const selectedAftermath = $derived(
        aftermathOptions.find((option) => option.id === selectedAftermathId) ?? null,
    )

    async function handleTaskStatusChange(taskId: string, newStatusId: string) {
        if (!updateTaskStatus || !sessionTaskIds.has(taskId)) return

        const machine = await loadTaskStatusMachine()
        const newStatus = machine.statuses.find((entry) => entry.id === newStatusId)

        if (isTerminalStatus(newStatus)) {
            await markPlannedSessionsNoLongerNeededAfter(taskId, session.ended_at)
        }
    }

    function openIconPicker() {
        if (!iconButtonEl) return

        const rect = iconButtonEl.getBoundingClientRect()
        iconPickerAnchor = {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
        }
    }

    function closeIconPicker() {
        iconPickerAnchor = null
    }

    async function handleSave() {
        if (saving) return

        saving = true
        error = null

        try {
            let aftermathId: string

            if (mode === 'existing') {
                if (!selectedAftermathId) {
                    error = 'Select an existing aftermath'
                    return
                }

                aftermathId = selectedAftermathId
            } else {
                const created = await createAftermath({
                    score,
                    description: description.trim() || null,
                    icon,
                    color: colorHexToInt(colorHex),
                })
                aftermathId = created.id
            }

            await linkAftermathToSession(session.id, aftermathId)
            returnToDashboardMain()
            await onComplete?.()
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to assign aftermath'
        } finally {
            saving = false
        }
    }

    async function handleSkip() {
        returnToDashboardMain()
        await onSkip?.()
    }

    onMount(async () => {
        loading = true

        if (session.tasks.length === 1) {
            description = `Finished working on ${session.tasks[0].title}`
        } else if (session.tasks.length > 1) {
            description = `Finished working on ${session.tasks.map((task) => task.title).join(', ')}`
        }

        try {
            aftermathOptions = await loadAftermathOptions()
            mode = aftermathOptions.length > 0 ? 'existing' : 'new'
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to load aftermaths'
            mode = 'new'
        } finally {
            loading = false
        }
    })
</script>

<div class="flex flex-col gap-6">
    <SessionWithTask {session} showStatus showTasks />

    {#if error}
        <div class="alert alert-error text-sm">
            <span>{error}</span>
        </div>
    {/if}

    <section class="rounded-box border border-base-300 bg-base-100 p-5 shadow-sm">
        <h2 class="text-lg font-semibold">Aftermath</h2>
        <p class="mt-1 text-sm text-base-content/60">
            Assign a shared aftermath to this session. The same aftermath can be reused across sessions.
        </p>

        {#if loading}
            <div class="mt-4 flex min-h-24 items-center justify-center">
                <span class="loading loading-spinner loading-md text-primary"></span>
            </div>
        {:else}
            <div class="mt-4 flex flex-col gap-4">
                <div role="tablist" class="tabs tabs-boxed w-fit">
                    <button
                            type="button"
                            role="tab"
                            class="tab"
                            class:tab-active={mode === 'existing'}
                            disabled={aftermathOptions.length === 0}
                            onclick={() => {
                                mode = 'existing'
                            }}
                    >
                        Use existing
                    </button>
                    <button
                            type="button"
                            role="tab"
                            class="tab"
                            class:tab-active={mode === 'new'}
                            onclick={() => {
                                mode = 'new'
                            }}
                    >
                        Create new
                    </button>
                </div>

                {#if mode === 'existing'}
                    {#if aftermathOptions.length === 0}
                        <p class="text-sm text-base-content/60">
                            No aftermaths yet. Create one to reuse across sessions.
                        </p>
                    {:else}
                        <AftermathSearchableSelect
                                label="Existing aftermath"
                                options={aftermathOptions}
                                bind:value={selectedAftermathId}
                                placeholder="Choose an aftermath"
                        />

                        {#if selectedAftermath}
                            <div
                                    class="rounded-box border px-4 py-3"
                                    style:border-color={mixDisplayColorInt(selectedAftermath.color, 'oklch(var(--b3))')}
                                    style:background-color="color-mix(in srgb, {mixDisplayColorInt(selectedAftermath.color, '#808080')} 12%, transparent)"
                            >
                                <div class="flex items-start gap-3">
                                    <LucideIcon
                                            name={selectedAftermath.icon}
                                            size={22}
                                            color={selectedAftermath.color}
                                    />
                                    <div class="min-w-0 flex-1">
                                        <p class="font-medium">{selectedAftermath.title}</p>
                                        {#if selectedAftermath.description?.trim()}
                                            <p class="mt-1 text-sm text-base-content/70">
                                                {selectedAftermath.description}
                                            </p>
                                        {/if}
                                        {#if selectedAftermath.score != null}
                                            <p class="mt-1 text-xs text-base-content/60">
                                                Satisfaction: {selectedAftermath.score}/5
                                            </p>
                                        {/if}
                                    </div>
                                </div>
                            </div>
                        {/if}
                    {/if}
                {:else}
                    <div class="flex flex-col gap-4">
                        <label class="form-control w-full">
                            <div class="label">
                                <span class="label-text">Satisfaction score</span>
                                <span class="label-text-alt">{score}/5</span>
                            </div>
                            <input
                                    type="range"
                                    min="1"
                                    max="5"
                                    step="1"
                                    class="range range-primary"
                                    bind:value={score}
                            />
                        </label>

                        <label class="form-control w-full">
                            <span class="label-text mb-1">Description</span>
                            <textarea
                                    class="textarea textarea-bordered w-full"
                                    rows="3"
                                    bind:value={description}
                                    placeholder="Describe this aftermath for reuse across sessions"
                            ></textarea>
                        </label>

                        <div class="flex flex-wrap items-end gap-4">
                            <div class="form-control">
                                <span class="label-text mb-1">Icon</span>
                                <button
                                        type="button"
                                        class="btn btn-outline gap-2"
                                        bind:this={iconButtonEl}
                                        onclick={openIconPicker}
                                >
                                    {#if icon}
                                        <LucideIcon name={icon} size={18} color={colorHexToInt(colorHex)} />
                                    {/if}
                                    {icon ?? 'Pick icon'}
                                </button>
                            </div>

                            <label class="form-control">
                                <span class="label-text mb-1">Color</span>
                                <input
                                        type="color"
                                        class="h-10 w-16 cursor-pointer rounded border border-base-300"
                                        bind:value={colorHex}
                                />
                            </label>
                        </div>
                    </div>
                {/if}
            </div>
        {/if}
    </section>

    {#if session.tasks.length > 0}
        <section class="rounded-box border border-base-300 bg-base-100 p-5 shadow-sm">
            <label class="label cursor-pointer justify-start gap-3">
                <input type="checkbox" class="checkbox checkbox-primary" bind:checked={updateTaskStatus} />
                <span>
                    <span class="font-semibold">Update task status</span>
                    <span class="block text-sm text-base-content/60">
                        Drag any included task to a new status on the graph below.
                    </span>
                </span>
            </label>

            {#if updateTaskStatus}
                <div class="mt-4 h-80 min-h-0">
                    <GraphKanbanBoard
                            embedded
                            filterTaskIds={taskFilterIds}
                            onTaskStatusChange={handleTaskStatusChange}
                    />
                </div>
            {/if}
        </section>
    {/if}

    <div class="flex flex-wrap justify-end gap-2 pb-4">
        <button type="button" class="btn btn-ghost" disabled={saving} onclick={() => void handleSkip()}>
            Skip for now
        </button>
        <button type="button" class="btn btn-primary" disabled={saving || loading} onclick={() => void handleSave()}>
            {#if saving}
                <span class="loading loading-spinner loading-sm"></span>
            {/if}
            Assign aftermath
        </button>
    </div>
</div>

{#if iconPickerAnchor}
    <IconPickerPopover
            anchor={iconPickerAnchor}
            value={icon}
            iconColor={colorHexToInt(colorHex)}
            onSelect={(nextIcon) => {
                icon = nextIcon
                closeIconPicker()
            }}
            onClose={closeIconPicker}
    />
{/if}
