<script lang="ts">
    import { ArrowUpDown, Filter, ListTree, Trophy } from 'lucide-svelte'

    import ColumnSortEditor from '$lib/components/kanban/ColumnSortEditor.svelte'
    import KanbanFilterEditor from '$lib/components/kanban/KanbanFilterEditor.svelte'
    import type { KanbanGlobalFilters } from '$lib/kanban/kanbanGlobalFilters'
    import type { KanbanFilterRoot } from '$lib/kanban/filterTypes'
    import type { ColumnSortConfig } from '$lib/kanban/types'

    let {
        filters,
        onChange,
    }: {
        filters: KanbanGlobalFilters
        onChange?: (nextFilters: KanbanGlobalFilters) => void
    } = $props()

    function updateFilter(patch: Partial<KanbanGlobalFilters>) {
        onChange?.({ ...filters, ...patch })
    }

    function handleGlobalColumnFilterChange(nextFilter: KanbanFilterRoot) {
        updateFilter({ globalColumnFilter: nextFilter })
    }

    function handleGlobalColumnSortChange(nextSort: ColumnSortConfig) {
        updateFilter({ globalColumnSort: nextSort })
    }

    function toggleFilter(key: 'ignoreTrophyTasks' | 'ignoreTasksWithChildren' | 'useGlobalColumnFilter' | 'useGlobalColumnSort') {
        updateFilter({ [key]: !filters[key] })
    }
</script>

<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
    <span class="text-sm font-semibold uppercase tracking-wide text-base-content/60">
        Global
    </span>

    <span class="tooltip tooltip-bottom" data-tip="Ignore trophy tasks">
        <button
                type="button"
                class="btn btn-ghost btn-xs btn-square"
                class:btn-active={filters.ignoreTrophyTasks}
                aria-pressed={filters.ignoreTrophyTasks}
                aria-label="Ignore trophy tasks"
                onclick={() => toggleFilter('ignoreTrophyTasks')}
        >
            <Trophy class="h-3.5 w-3.5" />
        </button>
    </span>

    <span class="tooltip tooltip-bottom" data-tip="Ignore tasks with child tasks">
        <button
                type="button"
                class="btn btn-ghost btn-xs btn-square"
                class:btn-active={filters.ignoreTasksWithChildren}
                aria-pressed={filters.ignoreTasksWithChildren}
                aria-label="Ignore tasks with child tasks"
                onclick={() => toggleFilter('ignoreTasksWithChildren')}
        >
            <ListTree class="h-3.5 w-3.5" />
        </button>
    </span>

    <div class="flex items-center gap-1">
        <span class="tooltip tooltip-bottom" data-tip="Apply column filter to all columns">
            <button
                    type="button"
                    class="btn btn-ghost btn-xs btn-square"
                    class:btn-active={filters.useGlobalColumnFilter}
                    aria-pressed={filters.useGlobalColumnFilter}
                    aria-label="Apply column filter to all columns"
                    onclick={() => toggleFilter('useGlobalColumnFilter')}
            >
                <Filter class="h-3.5 w-3.5" />
            </button>
        </span>

        <KanbanFilterEditor
                filter={filters.globalColumnFilter}
                panelTitle="Global column filter"
                panelDescription="When active, this filter overrides every column."
                disabled={!filters.useGlobalColumnFilter}
                disabledTitle="Enable global column filter to edit"
                onChange={handleGlobalColumnFilterChange}
        />
    </div>

    <div class="flex items-center gap-1">
        <span class="tooltip tooltip-bottom" data-tip="Apply column sort to all columns">
            <button
                    type="button"
                    class="btn btn-ghost btn-xs btn-square"
                    class:btn-active={filters.useGlobalColumnSort}
                    aria-pressed={filters.useGlobalColumnSort}
                    aria-label="Apply column sort to all columns"
                    onclick={() => toggleFilter('useGlobalColumnSort')}
            >
                <ArrowUpDown class="h-3.5 w-3.5" />
            </button>
        </span>

        <ColumnSortEditor
                sortRules={filters.globalColumnSort}
                disabled={!filters.useGlobalColumnSort}
                disabledTitle="Enable global column sort to edit"
                onChange={handleGlobalColumnSortChange}
        />
    </div>
</div>
