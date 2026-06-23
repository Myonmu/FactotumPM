<script lang="ts">

    import { Plus, Flag, CircleStop, GripVertical } from 'lucide-svelte'



    import ColumnSortEditor from '$lib/components/kanban/ColumnSortEditor.svelte'

    import KanbanCard from '$lib/components/kanban/KanbanCard.svelte'

    import KanbanFilterEditor from '$lib/components/kanban/KanbanFilterEditor.svelte'

    import type { TaskRecord } from '$lib/db/dataView'

    import type { DomainOption } from '$lib/db/dataView'

    import type { TaskStatusRecord } from '$lib/db/taskStatusMachine'

    import { isTerminalStatus } from '$lib/db/taskStatusMachine'

    import { colorIntToHex } from '$lib/grid/colorUtils'

    import type { KanbanFilterRoot } from '$lib/kanban/filterTypes'

    import { createDefaultFilter } from '$lib/kanban/filterUtils'

    import type { ColumnSortConfig } from '$lib/kanban/types'



    let {

        status,

        tasks = [],

        sortRules = [],

        filterRules = createDefaultFilter(),

        totalTaskCount = tasks.length,

        dropHighlight = null,

        draggingTaskId = null,

        domains = [],

        onSortChange,

        onFilterChange,

        onPointerDragStart,

        onCardClick,

        onAddTask,

        filterDisabled = false,

        sortDisabled = false,

        onColumnDragStart,

        isColumnDragging = false,

        columnReorderTarget = false,

    }: {

        status: TaskStatusRecord

        tasks?: TaskRecord[]

        sortRules?: ColumnSortConfig

        filterRules?: KanbanFilterRoot

        totalTaskCount?: number

        dropHighlight?: 'allowed' | 'denied' | null

        draggingTaskId?: string | null

        domains?: DomainOption[]

        onSortChange?: (rules: ColumnSortConfig) => void

        onFilterChange?: (filter: KanbanFilterRoot) => void

        onPointerDragStart?: (event: PointerEvent, taskId: string) => void

        onCardClick?: (task: TaskRecord) => void

        onAddTask?: (statusId: string) => void

        filterDisabled?: boolean

        sortDisabled?: boolean

        onColumnDragStart?: (event: PointerEvent, statusId: string) => void

        isColumnDragging?: boolean

        columnReorderTarget?: boolean

    } = $props()



    let sortMenuOpen = $state(false)

    let filterMenuOpen = $state(false)



    const statusColor = $derived(colorIntToHex(status.color))

    const isTerminal = $derived(isTerminalStatus(status))

    const headerMenuOpen = $derived(sortMenuOpen || filterMenuOpen)

    const taskCountLabel = $derived(

        totalTaskCount !== tasks.length

            ? `${tasks.length}/${totalTaskCount} tasks`

            : `${tasks.length} tasks`,

    )



    const showDropRing = $derived(dropHighlight != null || columnReorderTarget)



    function handleSortMenuOpenChange(open: boolean) {

        sortMenuOpen = open

    }



    function handleFilterMenuOpenChange(open: boolean) {

        filterMenuOpen = open

    }

</script>



<section

        class="kanban-column flex h-full min-h-[24rem] w-72 shrink-0 flex-col rounded-box border border-base-300 bg-base-200/70 transition-shadow"

        class:z-20={headerMenuOpen}

        class:ring-2={showDropRing}

        class:ring-primary={dropHighlight === 'allowed'}

        class:ring-error={dropHighlight === 'denied'}

        class:opacity-50={isColumnDragging}

        class:ring-secondary={columnReorderTarget && dropHighlight == null}

        data-status-id={status.id}

>

    <header

            class="sticky top-0 z-10 overflow-visible border-b border-base-300 bg-base-200/95 px-3 py-2 backdrop-blur"

            class:z-30={headerMenuOpen}

            style={statusColor ? `border-top: 3px solid ${statusColor}` : ''}

    >

        <div class="flex items-start justify-between gap-2">

            <div class="flex min-w-0 flex-1 items-start gap-1">

                {#if onColumnDragStart}

                    <button

                            type="button"

                            class="kanban-column-drag-handle btn btn-ghost btn-xs btn-square shrink-0 cursor-grab touch-none active:cursor-grabbing"

                            title="Drag to reorder column"

                            aria-label="Drag to reorder column"

                            onpointerdown={(event) => onColumnDragStart(event, status.id)}

                    >

                        <GripVertical class="h-3.5 w-3.5" />

                    </button>

                {/if}

                <div class="min-w-0 flex-1">

                    <div class="flex items-center gap-1.5">

                        {#if status.is_initial}

                            <span class="tooltip tooltip-right" data-tip="Initial status">

                                <Flag class="h-3.5 w-3.5 shrink-0 text-warning" />

                            </span>

                        {/if}

                        {#if isTerminal}

                            <span class="tooltip tooltip-right" data-tip="Terminal status">

                                <CircleStop class="h-3.5 w-3.5 shrink-0 text-base-content/50" />

                            </span>

                        {/if}

                        <h2 class="truncate text-sm font-semibold">{status.name}</h2>

                    </div>

                    <p class="text-xs text-base-content/60">{taskCountLabel}</p>

                </div>

            </div>



            {#if onAddTask}

                <button

                        type="button"

                        class="btn btn-ghost btn-xs btn-square shrink-0"

                        title="Add task"

                        onclick={() => onAddTask?.(status.id)}

                >

                    <Plus class="h-3.5 w-3.5" />

                </button>

            {/if}

        </div>



        <div class="mt-2 flex items-center gap-1">

            <KanbanFilterEditor

                    filter={filterRules}

                    disabled={filterDisabled}

                    disabledTitle="Using global column filter"

                    onChange={onFilterChange}

                    onOpenChange={handleFilterMenuOpenChange}

            />

            <ColumnSortEditor

                    {sortRules}

                    disabled={sortDisabled}

                    disabledTitle="Using global column sort"

                    onChange={onSortChange}

                    onOpenChange={handleSortMenuOpenChange}

            />

        </div>

    </header>



    <div class="kanban-column-body flex flex-1 flex-col gap-2 overflow-y-auto p-2">

        {#each tasks as task (task.id)}

            <KanbanCard

                    {task}

                    {domains}

                    dimmed={isTerminal}

                    dragging={draggingTaskId === task.id}

                    onPointerDragStart={onPointerDragStart}

                    onClick={() => onCardClick?.(task)}

            />

        {/each}



        {#if tasks.length === 0}

            <div

                    class="flex flex-1 items-center justify-center rounded-lg border border-dashed border-base-300 px-3 py-8 text-center text-xs text-base-content/50"

            >

                {totalTaskCount > 0 ? 'No tasks match this column filter' : 'Drop tasks here'}

            </div>

        {/if}

    </div>

</section>


