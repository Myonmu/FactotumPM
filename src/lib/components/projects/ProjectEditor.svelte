<script lang="ts">
    import { Trash2 } from 'lucide-svelte'

    import IconPickerPopover from '$lib/components/IconPickerPopover.svelte'
    import LucideIcon from '$lib/components/LucideIcon.svelte'
    import OptionalColorInput from '$lib/components/OptionalColorInput.svelte'
    import type { ProjectRecord } from '$lib/db/projects'

    let {
        project,
        saving = false,
        onSave,
        onDelete,
        onCancel,
    }: {
        project: ProjectRecord
        saving?: boolean
        onSave: (patch: {
            name: string
            description: string | null
            color: number | null
            icon: string | null
        }) => void | Promise<void>
        onDelete?: () => void | Promise<void>
        onCancel?: () => void
    } = $props()

    let name = $state(project.name)
    let description = $state(project.description ?? '')
    let color = $state<number | null>(project.color)
    let icon = $state<string | null>(project.icon)
    let error = $state<string | null>(null)
    let iconPickerOpen = $state(false)
    let iconButtonEl = $state<HTMLButtonElement | null>(null)
    let loadedProjectId = $state(project.id)
    let skipAutoSave = $state(true)
    let saveTimer: ReturnType<typeof setTimeout> | undefined
    let lastPersistedSnapshot = $state('')

    function buildPatch() {
        return {
            name: name.trim(),
            description: description.trim() || null,
            color,
            icon: icon?.trim() || null,
        }
    }

    function payloadSnapshot() {
        return JSON.stringify(buildPatch())
    }

    $effect(() => {
        if (project.id !== loadedProjectId) {
            name = project.name
            description = project.description ?? ''
            color = project.color
            icon = project.icon
            loadedProjectId = project.id
            skipAutoSave = true
            lastPersistedSnapshot = payloadSnapshot()
        }
    })

    async function persist() {
        if (!name.trim()) {
            error = 'Project name is required'
            return
        }

        const snapshot = payloadSnapshot()
        if (snapshot === lastPersistedSnapshot) return

        error = null
        try {
            await onSave(buildPatch())
            lastPersistedSnapshot = snapshot
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to save project'
        }
    }

    $effect(() => {
        const _snapshot = JSON.stringify({ name, description, color, icon })

        if (skipAutoSave) {
            skipAutoSave = false
            lastPersistedSnapshot = payloadSnapshot()
            return
        }

        if (!name.trim()) {
            error = 'Project name is required'
            return
        }

        error = null
        clearTimeout(saveTimer)
        saveTimer = setTimeout(() => {
            void persist()
        }, 400)

        return () => {
            clearTimeout(saveTimer)
        }
    })

    async function handleDelete() {
        if (!onDelete) return
        error = null
        try {
            await onDelete()
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to delete project'
        }
    }
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
    <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        <label class="form-control w-full gap-1">
            <span class="label-text font-semibold">Name</span>
            <input
                    class="input input-bordered w-full"
                    class:input-error={error != null && !name.trim()}
                    bind:value={name}
            />
        </label>

        <label class="form-control w-full gap-1">
            <span class="label-text font-semibold">Description</span>
            <span class="label-text-alt text-base-content/50">optional</span>
            <textarea
                    class="textarea textarea-bordered w-full resize-none"
                    rows="3"
                    bind:value={description}
            ></textarea>
        </label>

        <div class="form-control w-full gap-1">
            <span class="label-text font-semibold">Color</span>
            <OptionalColorInput
                    value={color}
                    onChange={(next) => { color = next }}
                    onClear={() => { color = null }}
            />
        </div>

        <div class="form-control w-full gap-1">
            <span class="label-text font-semibold">Icon</span>
            <div class="flex items-center gap-2">
                <button
                        bind:this={iconButtonEl}
                        type="button"
                        class="btn btn-sm btn-outline gap-2"
                        onclick={() => { iconPickerOpen = !iconPickerOpen }}
                >
                    {#if icon}
                        <LucideIcon name={icon} size={16} {color} />
                        {icon}
                    {:else}
                        Choose icon
                    {/if}
                </button>
                {#if icon}
                    <button
                            type="button"
                            class="btn btn-sm btn-ghost"
                            onclick={() => { icon = null }}
                    >
                        Clear
                    </button>
                {/if}
            </div>
            {#if iconPickerOpen && iconButtonEl}
                <IconPickerPopover
                        anchor={{
                            top: iconButtonEl.getBoundingClientRect().bottom,
                            left: iconButtonEl.getBoundingClientRect().left,
                            width: iconButtonEl.getBoundingClientRect().width,
                            height: iconButtonEl.getBoundingClientRect().height,
                        }}
                        value={icon}
                        iconColor={color}
                        onSelect={(next) => {
                            icon = next
                            iconPickerOpen = false
                        }}
                        onClose={() => { iconPickerOpen = false }}
                />
            {/if}
        </div>

        {#if error}
            <div class="alert alert-error py-2 text-sm">
                <span>{error}</span>
            </div>
        {/if}
    </div>

    <div class="mt-auto flex flex-wrap items-center gap-2 border-t border-base-300 pt-4">
        {#if onCancel}
            <button class="btn btn-ghost" onclick={() => onCancel?.()}>
                Close
            </button>
        {/if}
        {#if onDelete}
            <button
                    class="btn btn-error btn-outline"
                    disabled={saving}
                    onclick={() => void handleDelete()}
            >
                <Trash2 class="h-4 w-4" />
                Delete
            </button>
        {/if}
        {#if saving}
            <span class="ml-auto flex items-center gap-2 text-sm text-base-content/60">
                <span class="loading loading-spinner loading-xs"></span>
                Saving…
            </span>
        {/if}
    </div>
</div>
