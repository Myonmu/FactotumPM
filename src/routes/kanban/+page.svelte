<script lang="ts">

    import { onMount } from 'svelte'

    import TableTab from '$lib/components/TableTab.svelte'

    import GraphKanbanBoard from '$lib/components/kanban/GraphKanbanBoard.svelte'

    import KanbanGlobalFilters from '$lib/components/kanban/KanbanGlobalFilters.svelte'

    import TraditionalKanbanBoard from '$lib/components/kanban/TraditionalKanbanBoard.svelte'

    import {
        DEFAULT_KANBAN_GLOBAL_FILTERS,
        loadKanbanGlobalFilters,
        saveKanbanGlobalFilters,
        type KanbanGlobalFilters as KanbanGlobalFilterSettings,
    } from '$lib/kanban/kanbanGlobalFilters'

    import type { KanbanViewMode } from '$lib/kanban/types'



    let viewMode = $state<KanbanViewMode>('traditional')

    let globalFilters = $state<KanbanGlobalFilterSettings>({ ...DEFAULT_KANBAN_GLOBAL_FILTERS })



    function handleGlobalFiltersChange(nextFilters: KanbanGlobalFilterSettings) {

        globalFilters = nextFilters

        void saveKanbanGlobalFilters(nextFilters)

    }



    onMount(() => {

        void loadKanbanGlobalFilters().then((loaded) => {

            globalFilters = loaded

        })

    })

</script>



<div class="flex h-full min-h-0 flex-col bg-base-200">

    <div class="sticky top-0 z-30 border-b border-base-300 bg-base-200/95 px-4 py-3 backdrop-blur">

        <div class="flex flex-wrap items-center justify-between gap-4">

            <div>

                <h1 class="text-2xl font-bold">Kanban</h1>

                <p class="mt-1 text-sm text-base-content/60">

                    {#if viewMode === 'traditional'}

                        Drag column headers to reorder columns. Drag tasks between status columns.

                    {:else}

                        Status columns on the workflow graph. Drag tasks to any column.

                    {/if}

                </p>

            </div>



            <div class="flex flex-wrap items-center gap-4">

                <KanbanGlobalFilters filters={globalFilters} onChange={handleGlobalFiltersChange} />



                <div class="flex flex-wrap items-center gap-2">

                    <span class="text-sm font-semibold uppercase tracking-wide text-base-content/60 mr-1">

                        View

                    </span>

                <TableTab

                        label="Traditional"

                        active={viewMode === 'traditional'}

                        onclick={() => (viewMode = 'traditional')}

                />

                <TableTab

                        label="Graph Kanban"

                        active={viewMode === 'graph'}

                        onclick={() => (viewMode = 'graph')}

                />

                </div>

            </div>

        </div>

    </div>



    <div class="flex min-h-0 flex-1 flex-col p-4">

        {#if viewMode === 'traditional'}

            <TraditionalKanbanBoard {globalFilters} />

        {:else}

            <GraphKanbanBoard {globalFilters} />

        {/if}

    </div>

</div>


