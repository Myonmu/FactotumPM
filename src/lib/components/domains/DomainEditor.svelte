<script lang="ts">
    import { Trash2 } from 'lucide-svelte'

    import DomainSearchableSelect from '$lib/components/DomainSearchableSelect.svelte'
    import IconPickerPopover from '$lib/components/IconPickerPopover.svelte'
    import LucideIcon from '$lib/components/LucideIcon.svelte'
    import OptionalColorInput from '$lib/components/OptionalColorInput.svelte'
    import ProjectSearchableSelect from '$lib/components/projects/ProjectSearchableSelect.svelte'
    import {
        collectDomainDescendantIds,
        type DomainRecord,
    } from '$lib/db/domains'
    import type { DomainOption } from '$lib/db/dataView'
    import { loadProjectOptions, type ProjectRef } from '$lib/db/projects'
    import { onMount } from 'svelte'

    let {
        domain,
        domains = [],
        saving = false,
        onSave,
        onDelete,
        onCancel,
    }: {
        domain: DomainRecord
        domains?: DomainOption[]
        saving?: boolean
        onSave: (patch: {
            name: string
            description: string | null
            color: number | null
            icon: string | null
            parent_domain_id: string | null
            project_id: string | null
        }) => void | Promise<void>
        onDelete?: () => void | Promise<void>
        onCancel?: () => void
    } = $props()

    let name = $state(domain.name)
    let description = $state(domain.description ?? '')
    let color = $state<number | null>(domain.color)
    let icon = $state<string | null>(domain.icon)
    let parentDomainId = $state(domain.parent_domain_id ?? '')
    let projectId = $state(domain.project_id ?? '')
    let error = $state<string | null>(null)
    let iconPickerOpen = $state(false)
    let iconButtonEl = $state<HTMLButtonElement | null>(null)
    let projects = $state<ProjectRef[]>([])

    onMount(() => {
        void loadProjectOptions().then((entries) => {
            projects = entries
        })
    })

    const parentDomainOptions = $derived.by((): DomainOption[] => {
        const blocked = collectDomainDescendantIds(domain.id, domains)
        blocked.add(domain.id)

        return domains.filter((entry) => !blocked.has(entry.id))
    })

    $effect(() => {
        name = domain.name
        description = domain.description ?? ''
        color = domain.color
        icon = domain.icon
        parentDomainId = domain.parent_domain_id ?? ''
        projectId = domain.project_id ?? ''
    })

    async function handleSave() {
        if (!name.trim()) {
            error = 'Domain name is required'
            return
        }

        error = null
        try {
            await onSave({
                name: name.trim(),
                description: description.trim() || null,
                color,
                icon: icon?.trim() || null,
                parent_domain_id: parentDomainId.trim() || null,
                project_id: projectId.trim() || null,
            })
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to save domain'
        }
    }

    async function handleDelete() {
        if (!onDelete) return
        error = null
        try {
            await onDelete()
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to delete domain'
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
            <span class="label-text font-semibold">Parent domain</span>
            <DomainSearchableSelect
                    label=""
                    domains={parentDomainOptions}
                    bind:value={parentDomainId}
                    placeholder="None (top level)"
            />
        </div>

        <ProjectSearchableSelect
                label="Project"
                {projects}
                value={projectId}
                placeholder="Global (all projects)"
                group="domain-inspector"
                onSelect={(id) => { projectId = id }}
        />

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

    <div class="mt-auto flex flex-wrap gap-2 border-t border-base-300 pt-4">
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
        <button
                class="btn btn-primary ml-auto"
                disabled={saving || !name.trim()}
                onclick={() => void handleSave()}
        >
            {#if saving}
                <span class="loading loading-spinner loading-sm"></span>
            {/if}
            Save
        </button>
    </div>
</div>
