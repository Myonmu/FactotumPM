<script lang="ts">
    import {
        createDb,
        findDb,
        getDbEntries,
        getSelectedEntryId,
        importDb,
        isCreateMode,
        isStaleEntry,
        removeDb,
        selectDbEntry,
        getSelectedEntry,
    } from "$lib/loginSession.svelte";
    import { Database, FolderOpen, Trash2 } from "lucide-svelte";

    const dbEntries = $derived(getDbEntries());
    const selectedEntryId = $derived(getSelectedEntryId());
    const selectedEntry = $derived(getSelectedEntry());
</script>

<div class="card w-full max-w-xs shadow-xl bg-base-100">
    <div class="card-body gap-4 p-5">
        <div>
            <h3 class="text-lg font-semibold">Databases</h3>
            <p class="text-sm text-base-content/60">
                Choose a database to connect to.
            </p>
        </div>

        <ul class="menu menu-sm rounded-box border border-base-300 bg-base-200/40 p-1">
            {#each dbEntries as entry (entry.id)}
                <li>
                    <button
                        type="button"
                        class:menu-active={entry.id === selectedEntryId}
                        class="flex items-center gap-2"
                        onclick={() => selectDbEntry(entry.id)}
                    >
                        <Database class="h-4 w-4 shrink-0 opacity-70" />
                        <span class="min-w-0 flex-1 truncate text-left">
                            {entry.name}
                        </span>
                        {#if isStaleEntry(entry)}
                            <span class="badge badge-warning badge-xs">
                                invalid
                            </span>
                        {:else if isCreateMode(entry)}
                            <span class="badge badge-info badge-xs">new</span>
                        {/if}
                    </button>
                </li>
            {/each}
        </ul>

        {#if selectedEntry && isStaleEntry(selectedEntry)}
            <div class="space-y-2 rounded-box border border-warning/30 bg-warning/10 p-3">
                <p class="text-sm text-warning-content">
                    This database file could not be found at the saved
                    location.
                </p>
                <div class="flex gap-2">
                    <button
                        type="button"
                        class="btn btn-sm btn-outline flex-1 gap-1"
                        onclick={() => findDb(selectedEntry.id)}
                    >
                        <FolderOpen class="h-4 w-4" />
                        Find
                    </button>
                    {#if !selectedEntry.isDefault}
                        <button
                            type="button"
                            class="btn btn-sm btn-error btn-outline gap-1"
                            onclick={() => removeDb(selectedEntry.id)}
                        >
                            <Trash2 class="h-4 w-4" />
                            Delete
                        </button>
                    {/if}
                </div>
            </div>
        {/if}

        <div class="flex gap-2">
            <button
                type="button"
                class="btn btn-sm btn-outline flex-1"
                onclick={importDb}
            >
                Import
            </button>
            <button
                type="button"
                class="btn btn-sm btn-outline flex-1"
                onclick={createDb}
            >
                Create
            </button>
        </div>
    </div>
</div>
