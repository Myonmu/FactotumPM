<script lang="ts">
    import { FolderOpen, FolderKanban, Plus, ChevronDown } from 'lucide-svelte'
    import { colorIntToHex } from '$lib/grid/colorUtils'
    import {
        getCurrentProjectId,
        getCurrentProject,
        getProjects,
        selectProject,
        createAndSelectProject,
    } from '$lib/projectState.svelte'

    let creating = $state(false)
    let newProjectName = $state('')
    let dropdownOpen = $state(false)

    const currentProject = $derived(getCurrentProject())
    const projects = $derived(getProjects())
    const currentProjectId = $derived(getCurrentProjectId())

    async function handleSelect(id: string | null) {
        await selectProject(id)
        dropdownOpen = false
    }

    async function handleCreate() {
        const name = newProjectName.trim()
        if (!name) return
        creating = true
        try {
            await createAndSelectProject({ name })
            newProjectName = ''
            dropdownOpen = false
        } finally {
            creating = false
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') void handleCreate()
    }
</script>

<div class="dropdown dropdown-end">
    <button
        class="btn btn-sm flex items-center gap-1.5 max-w-40"
        onclick={() => (dropdownOpen = !dropdownOpen)}
        aria-haspopup="listbox"
        aria-expanded={dropdownOpen}
    >
        {#if currentProject}
            {#if currentProject.color}
                <span
                    class="w-2 h-2 rounded-full shrink-0"
                    style:background-color={colorIntToHex(currentProject.color)}
                ></span>
            {:else}
                <FolderKanban class="w-4 h-4 shrink-0" />
            {/if}
            <span class="truncate text-sm">{currentProject.name}</span>
        {:else}
            <FolderOpen class="w-4 h-4 shrink-0" />
            <span class="text-sm">All Projects</span>
        {/if}
        <ChevronDown class="w-3 h-3 shrink-0 opacity-60" />
    </button>

    {#if dropdownOpen}
        <div
            class="dropdown-content z-50 bg-base-100 rounded-box shadow-2xl border border-base-300 mt-1 min-w-52 max-h-80 overflow-y-auto"
            role="listbox"
        >
            <ul class="menu p-1">
                <li>
                    <button
                        class="flex items-center gap-2 w-full"
                        class:bg-primary={currentProjectId === null}
                        class:text-primary-content={currentProjectId === null}
                        onclick={() => handleSelect(null)}
                        role="option"
                        aria-selected={currentProjectId === null}
                    >
                        <FolderOpen class="w-4 h-4 shrink-0" />
                        <span class="font-medium">All Projects</span>
                    </button>
                </li>

                {#if projects.length > 0}
                    <li class="menu-title text-xs mt-1">Projects</li>
                {/if}

                {#each projects as proj (proj.id)}
                    <li>
                        <button
                            class="flex items-center gap-2 w-full"
                            class:bg-primary={currentProjectId === proj.id}
                            class:text-primary-content={currentProjectId === proj.id}
                            onclick={() => handleSelect(proj.id)}
                            role="option"
                            aria-selected={currentProjectId === proj.id}
                        >
                            {#if proj.color}
                                <span
                                    class="w-2.5 h-2.5 rounded-full shrink-0"
                                    style:background-color={colorIntToHex(proj.color)}
                                ></span>
                            {:else}
                                <FolderKanban class="w-4 h-4 shrink-0" />
                            {/if}
                            <span class="truncate">{proj.name}</span>
                        </button>
                    </li>
                {/each}

                <li class="border-t border-base-300 mt-1 pt-1">
                    <div class="flex items-center gap-1 p-1">
                        <input
                            class="input input-xs input-bordered flex-1 min-w-0"
                            placeholder="New project name…"
                            bind:value={newProjectName}
                            onkeydown={handleKeydown}
                            disabled={creating}
                        />
                        <button
                            class="btn btn-xs btn-primary btn-square"
                            onclick={handleCreate}
                            disabled={creating || !newProjectName.trim()}
                            title="Create project"
                        >
                            {#if creating}
                                <span class="loading loading-spinner loading-xs"></span>
                            {:else}
                                <Plus class="w-3.5 h-3.5" />
                            {/if}
                        </button>
                    </div>
                </li>
            </ul>
        </div>

        <div
            class="fixed inset-0 z-40"
            onclick={() => (dropdownOpen = false)}
            role="presentation"
        ></div>
    {/if}
</div>
