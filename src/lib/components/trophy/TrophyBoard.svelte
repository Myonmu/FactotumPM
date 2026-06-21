<script lang="ts">
    import { goto } from '$app/navigation'
    import { onMount } from 'svelte'
    import { Network, RefreshCw } from 'lucide-svelte'

    import TableTab from '$lib/components/TableTab.svelte'
    import TrophyFilterEditor from '$lib/components/trophy/TrophyFilterEditor.svelte'
    import TrophyGrid from '$lib/components/trophy/TrophyGrid.svelte'
    import TrophyProgressionGraph from '$lib/components/trophy/TrophyProgressionGraph.svelte'
    import TrophySortEditor from '$lib/components/trophy/TrophySortEditor.svelte'
    import {
        fetchTableRows,
        loadDomainOptions,
        loadTaskDependencyEdges,
        recordToTask,
        type DomainOption,
        type TaskDependencyEdge,
        type TaskRecord,
    } from '$lib/db/dataView'
    import {
        loadTaskStatusMachine,
        loadTaskStatusOptions,
        isTerminalStatus,
    } from '$lib/db/taskStatusMachine'
    import type { KanbanFilterRoot } from '$lib/kanban/filterTypes'
    import { createDefaultFilter } from '$lib/kanban/filterUtils'
    import type { ColumnSortConfig } from '$lib/kanban/types'
    import {
        buildUndirectedTaskAdjacency,
        collectConnectedTaskIds,
    } from '$lib/route/connectivity'
    import { computeTrophies, type TrophyView } from '$lib/trophy/computeTrophies'
    import { loadSessionTimeIndex, type SessionTimeIndex } from '$lib/trophy/trophyTime'
    import { filterTrophies } from '$lib/trophy/evaluateTrophyFilter'
    import { groupTrophies } from '$lib/trophy/groupTrophies'
    import { requestRouteFocus } from '$lib/trophy/routeFocusRequest.svelte'
    import { sortTrophies } from '$lib/trophy/sortTrophies'
    import { DEFAULT_TROPHY_SORT, TROPHY_GROUP_OPTIONS } from '$lib/trophy/trophyFields'
    import {
        loadTrophyFilter,
        loadTrophyGroup,
        loadTrophySort,
        loadTrophyViewMode,
        saveTrophyFilter,
        saveTrophyGroup,
        saveTrophySort,
        saveTrophyViewMode,
        type TrophyViewMode,
    } from '$lib/trophy/trophyPrefs'

    let tasks = $state<TaskRecord[]>([])
    let domains = $state<DomainOption[]>([])
    let statuses = $state<{ id: string; title: string }[]>([])
    let terminalStatusIds = $state<Set<string>>(new Set())
    let dependencies = $state<TaskDependencyEdge[]>([])
    let sessionTime = $state<SessionTimeIndex | null>(null)

    let filter = $state<KanbanFilterRoot>(createDefaultFilter())
    let sort = $state<ColumnSortConfig>([...DEFAULT_TROPHY_SORT])
    let groupField = $state('none')
    let viewMode = $state<TrophyViewMode>('grid')

    let loading = $state(true)
    let error = $state<string | null>(null)

    const trophies = $derived(computeTrophies(tasks, terminalStatusIds, sessionTime))
    const visibleTrophies = $derived(sortTrophies(filterTrophies(trophies, filter), sort))
    const groups = $derived(groupTrophies(visibleTrophies, groupField, { domains, statuses }))

    const achievedCount = $derived(trophies.filter((trophy) => trophy.achieved).length)

    async function loadBoard() {
        loading = true
        error = null

        try {
            const [
                taskResult,
                loadedDomains,
                machine,
                statusOptions,
                loadedDependencies,
                loadedSessionTime,
            ] = await Promise.all([
                fetchTableRows('task'),
                loadDomainOptions(),
                loadTaskStatusMachine(),
                loadTaskStatusOptions(),
                loadTaskDependencyEdges(),
                loadSessionTimeIndex(),
            ])

            tasks = taskResult.rows.map(recordToTask)
            domains = loadedDomains
            statuses = statusOptions.map((status) => ({ id: status.id, title: status.title }))
            terminalStatusIds = new Set(
                machine.statuses.filter(isTerminalStatus).map((status) => status.id),
            )
            dependencies = loadedDependencies
            sessionTime = loadedSessionTime
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to load trophies'
        } finally {
            loading = false
        }
    }

    function handleFilterChange(nextFilter: KanbanFilterRoot) {
        filter = nextFilter
        void saveTrophyFilter(nextFilter)
    }

    function handleSortChange(nextSort: ColumnSortConfig) {
        sort = nextSort
        void saveTrophySort(nextSort)
    }

    function handleGroupChange(nextGroup: string) {
        groupField = nextGroup
        void saveTrophyGroup(nextGroup)
    }

    function handleViewModeChange(nextMode: TrophyViewMode) {
        viewMode = nextMode
        void saveTrophyViewMode(nextMode)
    }

    function handleTrophyClick(view: TrophyView) {
        const adjacency = buildUndirectedTaskAdjacency(tasks, dependencies)
        const componentIds = collectConnectedTaskIds(view.task.id, adjacency)
        requestRouteFocus([...componentIds], view.task.id)
        sessionStorage.setItem('activeTab', 'route')
        void goto('/route')
    }

    onMount(async () => {
        const [savedFilter, savedSort, savedGroup, savedViewMode] = await Promise.all([
            loadTrophyFilter(),
            loadTrophySort(),
            loadTrophyGroup(),
            loadTrophyViewMode(),
        ])
        filter = savedFilter
        sort = savedSort
        groupField = savedGroup
        viewMode = savedViewMode
        await loadBoard()
    })
</script>

<div class="flex h-full min-h-0 flex-col gap-3">
    <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm text-base-content/70">
                {trophies.length} trophies · {achievedCount} achieved
            </span>
        </div>

        <div class="flex flex-wrap items-center gap-2">
            {#if viewMode === 'grid'}
                <TrophyFilterEditor {filter} {domains} {statuses} onChange={handleFilterChange} />
                <TrophySortEditor sortRules={sort} onChange={handleSortChange} />
                <label class="flex items-center gap-1">
                    <span class="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                        Group
                    </span>
                    <select
                            class="select select-bordered select-sm h-9 min-h-9 py-0 text-sm leading-normal"
                            value={groupField}
                            onchange={(event) =>
                                handleGroupChange((event.currentTarget as HTMLSelectElement).value)}
                    >
                        {#each TROPHY_GROUP_OPTIONS as option (option.id)}
                            <option value={option.id}>{option.label}</option>
                        {/each}
                    </select>
                </label>
            {/if}

            <div class="ml-1 flex items-center gap-1">
                <TableTab
                        label="Grid"
                        active={viewMode === 'grid'}
                        onclick={() => handleViewModeChange('grid')}
                />
                <TableTab
                        label="Progression"
                        active={viewMode === 'graph'}
                        onclick={() => handleViewModeChange('graph')}
                />
            </div>

            <button class="btn btn-sm btn-ghost gap-2" disabled={loading} onclick={() => void loadBoard()}>
                <RefreshCw class="h-4 w-4" />
                Reload
            </button>
        </div>
    </div>

    {#if error}
        <div class="alert alert-error py-2 text-sm">
            <span>{error}</span>
        </div>
    {/if}

    {#if loading}
        <div class="flex min-h-[24rem] flex-1 items-center justify-center">
            <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>
    {:else if trophies.length === 0}
        <div class="flex min-h-[24rem] flex-1 items-center justify-center p-4">
            <div class="alert alert-info max-w-xl">
                <span>
                    No trophies yet. Mark a task as a trophy (the trophy toggle in the task editor) to
                    start tracking milestones here.
                </span>
            </div>
        </div>
    {:else if viewMode === 'grid'}
        <div class="min-h-0 flex-1 overflow-auto pb-6">
            {#if visibleTrophies.length === 0}
                <div class="flex min-h-[16rem] items-center justify-center p-4">
                    <div class="alert max-w-xl">
                        <span>No trophies match the current filter.</span>
                    </div>
                </div>
            {:else}
                <TrophyGrid {groups} {domains} onTrophyClick={handleTrophyClick} />
            {/if}
        </div>
    {:else}
        <div class="flex min-h-0 flex-1 flex-col">
            <div class="mb-2 flex items-center gap-2">
                <Network class="h-4 w-4 text-base-content/60" />
                <p class="text-sm text-base-content/70">
                    Trophy dependency tree. Regular tasks are collapsed into the trophy they belong to.
                    Click a trophy to open its route.
                </p>
            </div>
            <TrophyProgressionGraph
                    {tasks}
                    {dependencies}
                    {domains}
                    {terminalStatusIds}
                    {sessionTime}
                    onTrophyClick={handleTrophyClick}
            />
        </div>
    {/if}
</div>
