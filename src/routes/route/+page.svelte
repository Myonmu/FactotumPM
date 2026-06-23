<script lang="ts">
    import { ChevronLeft, ChevronRight, FolderKanban } from 'lucide-svelte'

    import RouteGraphBoard from '$lib/components/route/RouteGraphBoard.svelte'
    import {
        getRouteGraphNav,
        navigateRouteGraphBack,
        navigateRouteGraphForward,
    } from '$lib/route/routeGraphNav.svelte'
    import { getCurrentProjectId, getProjects } from '$lib/projectState.svelte'
    import { colorIntToHex } from '$lib/grid/colorUtils'

    const graphNav = $derived(getRouteGraphNav())

    // Route does NOT concatenate in All Projects mode - it needs its own project context
    const globalProjectId = $derived(getCurrentProjectId())
    const projects = $derived(getProjects())

    // When a specific project is selected globally, use it.
    // When in All Projects mode, use a local project selector.
    let localProjectId = $state<string | null>(null)

    const effectiveProjectId = $derived(
        globalProjectId !== null ? globalProjectId : localProjectId,
    )

    const showLocalSelector = $derived(globalProjectId === null)
</script>

<div class="flex h-full min-h-0 flex-col bg-base-200">
    <div class="sticky top-0 z-30 border-b border-base-300 bg-base-200/95 px-4 py-3 backdrop-blur">
        <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
                <h1 class="text-2xl font-bold">Route</h1>
                <p class="mt-1 text-sm text-base-content/60">
                    Task hierarchy and dependencies. Select a project to view its graph.
                </p>
            </div>

            <div class="flex flex-wrap items-center gap-3">
                {#if showLocalSelector}
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-semibold uppercase tracking-wide text-base-content/60">
                            Project
                        </span>
                        <select
                            class="select select-bordered select-sm h-9 min-h-9 py-0 text-sm leading-normal"
                            value={localProjectId ?? ''}
                            onchange={(e) => {
                                const val = (e.currentTarget as HTMLSelectElement).value
                                localProjectId = val || null
                            }}
                        >
                            <option value="">— select a project —</option>
                            {#each projects as proj (proj.id)}
                                <option value={proj.id}>{proj.name}</option>
                            {/each}
                        </select>
                    </div>
                {/if}

                <div class="flex flex-wrap items-center gap-2">
                    <span class="mr-1 text-sm font-semibold uppercase tracking-wide text-base-content/60">
                        Focus
                    </span>
                    <button
                        type="button"
                        class="btn btn-sm btn-ghost btn-square"
                        title="Back"
                        disabled={!graphNav.canGoBack}
                        onclick={() => navigateRouteGraphBack()}
                    >
                        <ChevronLeft class="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        class="btn btn-sm btn-ghost btn-square"
                        title="Forward"
                        disabled={!graphNav.canGoForward}
                        onclick={() => navigateRouteGraphForward()}
                    >
                        <ChevronRight class="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    </div>

    <div class="flex min-h-0 flex-1 flex-col p-4">
        {#if showLocalSelector && effectiveProjectId === null}
            <div class="flex flex-col items-center justify-center gap-3 py-16 text-base-content/40">
                <FolderKanban class="w-12 h-12" />
                <p class="text-sm">Select a project above to view its route graph.</p>
            </div>
        {:else}
            <RouteGraphBoard projectId={effectiveProjectId} />
        {/if}
    </div>
</div>
