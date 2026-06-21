<script lang="ts">
    import { ChevronLeft, ChevronRight } from 'lucide-svelte'

    import RouteGraphBoard from '$lib/components/route/RouteGraphBoard.svelte'
    import {
        getRouteGraphNav,
        navigateRouteGraphBack,
        navigateRouteGraphForward,
    } from '$lib/route/routeGraphNav.svelte'

    const graphNav = $derived(getRouteGraphNav())
</script>

<div class="flex h-full min-h-0 flex-col bg-base-200">
    <div class="sticky top-0 z-30 border-b border-base-300 bg-base-200/95 px-4 py-3 backdrop-blur">
        <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
                <h1 class="text-2xl font-bold">Route</h1>
                <p class="mt-1 text-sm text-base-content/60">
                    Task grouping and dependency map with automatic layout.
                </p>
            </div>

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

    <div class="flex min-h-0 flex-1 flex-col p-4">
        <RouteGraphBoard />
    </div>
</div>
