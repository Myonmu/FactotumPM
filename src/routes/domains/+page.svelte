<script lang="ts">
    import { Plus } from 'lucide-svelte'

    import DomainGraphBoard from '$lib/components/domains/DomainGraphBoard.svelte'
    import DomainKanbanBoard from '$lib/components/domains/DomainKanbanBoard.svelte'
    import TableTab from '$lib/components/TableTab.svelte'

    type DomainViewMode = 'tasks' | 'graph'

    let viewMode = $state<DomainViewMode>('tasks')
    let kanbanBoard = $state<{ createAndInspectDomain: () => Promise<void> } | undefined>()
    let graphBoard = $state<{ createAndInspectDomain: () => Promise<void> } | undefined>()
    let creating = $state(false)

    async function handleCreateDomain() {
        creating = true
        try {
            if (viewMode === 'tasks') {
                await kanbanBoard?.createAndInspectDomain()
            } else {
                await graphBoard?.createAndInspectDomain()
            }
        } finally {
            creating = false
        }
    }
</script>

<div class="flex h-full min-h-0 flex-col bg-base-200">
    <div class="sticky top-0 z-30 border-b border-base-300 bg-base-200/95 px-4 py-3 backdrop-blur">
        <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
                <h1 class="text-2xl font-bold">Domains</h1>
                <p class="mt-1 text-sm text-base-content/60">
                    {#if viewMode === 'tasks'}
                        Tasks grouped by domain. Drag tasks between columns or click a column header to edit the domain.
                    {:else}
                        Domain hierarchy graph. Click a node to inspect. Right-drag a subdomain onto a parent to reparent it.
                    {/if}
                </p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
                <button
                        class="btn btn-sm btn-primary gap-2"
                        disabled={creating}
                        onclick={() => void handleCreateDomain()}
                >
                    {#if creating}
                        <span class="loading loading-spinner loading-sm"></span>
                    {:else}
                        <Plus class="h-4 w-4" />
                    {/if}
                    New domain
                </button>

                <span class="text-sm font-semibold uppercase tracking-wide text-base-content/60 mx-1">
                    View
                </span>
                <TableTab
                        label="Tasks"
                        active={viewMode === 'tasks'}
                        onclick={() => (viewMode = 'tasks')}
                />
                <TableTab
                        label="Graph"
                        active={viewMode === 'graph'}
                        onclick={() => (viewMode = 'graph')}
                />
            </div>
        </div>
    </div>

    <div class="flex min-h-0 flex-1 flex-col p-4">
        {#if viewMode === 'tasks'}
            <DomainKanbanBoard bind:this={kanbanBoard} />
        {:else}
            <DomainGraphBoard bind:this={graphBoard} />
        {/if}
    </div>
</div>
