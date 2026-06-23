<script lang="ts">
    import { onMount } from 'svelte'
    import { FolderOpen, Plus, RefreshCw, Trash2, X } from 'lucide-svelte'

    import {
        addPromptEntry,
        loadPromptRegistry,
        pickPromptFile,
        pickNewPromptSavePath,
        registerPromptPath,
        reloadPromptRegistry,
        removePromptEntry,
        resolveAllPromptEntries,
        updatePromptEntryPath,
        writePromptEntry,
        type ResolvedPromptEntry,
    } from '$lib/llm'

    const {
        onClose,
        onChanged,
    }: {
        onClose?: () => void
        onChanged?: () => void
    } = $props()

    let entries = $state<ResolvedPromptEntry[]>([])
    let loading = $state(true)
    let reloading = $state(false)
    let error = $state<string | null>(null)

    async function refresh() {
        loading = true
        error = null
        try {
            const registry = await loadPromptRegistry()
            entries = await resolveAllPromptEntries(registry)
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to load prompts'
        } finally {
            loading = false
        }
    }

    onMount(() => {
        void refresh()
    })

    async function handleReload() {
        reloading = true
        error = null
        try {
            await reloadPromptRegistry()
            await refresh()
            onChanged?.()
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to reload prompts'
        } finally {
            reloading = false
        }
    }

    async function handleCreate() {
        const path = await pickNewPromptSavePath()
        if (!path) return

        const template = `# Custom agent prompt

[schema]

[context]

[queryable_tables]

When you need data during reasoning:
<factotum-tool>{"action":"query","sql":"SELECT ... LIMIT 20"}</factotum-tool>

## Result extraction (mandatory)

Each <factotum-view> body must be ONLY a SELECT query. The app runs the SQL; never paste tables, JSON, or tool results inside the tag.

<factotum-view type="table" title="Results">
SELECT id, title FROM task LIMIT 20
</factotum-view>

[tokens]
`

        try {
            const entry = await registerPromptPath(path)
            const resolved = { ...entry, resolvedPath: path, isValid: true }
            await writePromptEntry(resolved, template)
            await addPromptEntry(entry)
            await refresh()
            onChanged?.()
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to create prompt'
        }
    }

    async function handleImport() {
        const path = await pickPromptFile()
        if (!path) return

        try {
            const entry = await registerPromptPath(path)
            await addPromptEntry(entry)
            await refresh()
            onChanged?.()
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to import prompt'
        }
    }

    async function handleFind(entryId: string) {
        const path = await pickPromptFile()
        if (!path) return

        try {
            await updatePromptEntryPath(entryId, path)
            await refresh()
            onChanged?.()
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to relink prompt'
        }
    }

    async function handleRemove(entryId: string) {
        try {
            await removePromptEntry(entryId)
            await refresh()
            onChanged?.()
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to remove prompt'
        }
    }
</script>

<div class="modal modal-open">
    <div class="modal-box max-w-xl">
        <div class="mb-4 flex items-start justify-between gap-3">
            <div>
                <h3 class="text-lg font-bold">System prompts</h3>
                <p class="mt-1 text-sm text-base-content/60">
                    Prompts are markdown files with special tokens like [schema] and [context].
                </p>
            </div>
            <button type="button" class="btn btn-ghost btn-sm btn-square" onclick={() => onClose?.()}>
                <X class="h-4 w-4" />
            </button>
        </div>

        {#if loading}
            <div class="flex min-h-24 items-center justify-center">
                <span class="loading loading-spinner loading-md"></span>
            </div>
        {:else}
            <ul class="menu rounded-box border border-base-300 bg-base-200/40 p-1">
                {#each entries as entry (entry.id)}
                    <li>
                        <div class="flex items-center gap-2">
                            <div class="min-w-0 flex-1">
                                <p class="truncate font-medium">{entry.name}</p>
                                {#if entry.description}
                                    <p class="truncate text-xs text-base-content/60">
                                        {entry.description}
                                    </p>
                                {/if}
                            </div>
                            {#if !entry.isValid}
                                <span class="badge badge-warning badge-xs">missing</span>
                            {/if}
                            {#if entry.isDefault}
                                <span class="badge badge-ghost badge-xs">default</span>
                            {/if}
                            {#if !entry.isValid}
                                <button
                                        type="button"
                                        class="btn btn-ghost btn-xs btn-square"
                                        title="Find file"
                                        onclick={() => void handleFind(entry.id)}
                                >
                                    <FolderOpen class="h-3.5 w-3.5" />
                                </button>
                            {/if}
                            {#if !entry.isDefault}
                                <button
                                        type="button"
                                        class="btn btn-ghost btn-xs btn-square text-error"
                                        title="Remove"
                                        onclick={() => void handleRemove(entry.id)}
                                >
                                    <Trash2 class="h-3.5 w-3.5" />
                                </button>
                            {/if}
                        </div>
                    </li>
                {/each}
            </ul>
        {/if}

        {#if error}
            <div class="alert alert-error mt-4 text-sm">
                <span>{error}</span>
            </div>
        {/if}

        <div class="modal-action">
            <button type="button" class="btn btn-ghost" onclick={() => onClose?.()}>Close</button>
            <button
                    type="button"
                    class="btn btn-outline gap-2"
                    disabled={reloading || loading}
                    onclick={() => void handleReload()}
            >
                {#if reloading}
                    <span class="loading loading-spinner loading-sm"></span>
                {:else}
                    <RefreshCw class="h-4 w-4" />
                {/if}
                Reload prompts
            </button>
            <button type="button" class="btn btn-outline gap-2" onclick={() => void handleCreate()}>
                <Plus class="h-4 w-4" />
                Create prompt
            </button>
            <button type="button" class="btn btn-outline gap-2" onclick={() => void handleImport()}>
                <Plus class="h-4 w-4" />
                Import prompt file
            </button>
        </div>
    </div>
    <button type="button" class="modal-backdrop" aria-label="Close" onclick={() => onClose?.()}></button>
</div>
