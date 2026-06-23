<script lang="ts">

    import { Handle, Position, type Node, type NodeProps } from '@xyflow/svelte'

    import { Flag, Plus, CircleStop } from 'lucide-svelte'



    import ColumnSortEditor from '$lib/components/kanban/ColumnSortEditor.svelte'

    import KanbanCard from '$lib/components/kanban/KanbanCard.svelte'

    import KanbanFilterEditor from '$lib/components/kanban/KanbanFilterEditor.svelte'

    import type { TaskRecord } from '$lib/db/dataView'

    import type { DomainOption } from '$lib/db/dataView'

    import type { KanbanFilterRoot } from '$lib/kanban/filterTypes'

    import { createDefaultFilter } from '$lib/kanban/filterUtils'

    import type { ColumnSortConfig } from '$lib/kanban/types'

    import {
        DEFAULT_KANBAN_COLUMN_BODY_HEIGHT,
        MIN_KANBAN_COLUMN_BODY_HEIGHT,
    } from '$lib/kanban/kanbanColumnHeightPrefs'



    type KanbanColumnNodeData = {

        label: string

        description?: string | null

        isInitial?: boolean

        isTerminal?: boolean

        statusColor?: string | null

        tasks: TaskRecord[]

        totalTaskCount?: number

        sortRules: ColumnSortConfig

        filterRules?: KanbanFilterRoot

        isDropTarget?: boolean

        draggingTaskId?: string | null

        domains: DomainOption[]

        onSortChange?: (rules: ColumnSortConfig) => void

        onFilterChange?: (filter: KanbanFilterRoot) => void

        onPointerDragStart?: (event: PointerEvent, taskId: string) => void

        onCardClick?: (task: TaskRecord) => void

        onAddTask?: (statusId: string) => void

        showControls?: boolean

        columnBodyHeight?: number

        onColumnBodyHeightChange?: (height: number) => void

        filterDisabled?: boolean

        sortDisabled?: boolean

    }



    type KanbanColumnNodeType = Node<KanbanColumnNodeData, 'kanbanColumn'>



    let { id, data }: NodeProps<KanbanColumnNodeType> = $props()



    let sortMenuOpen = $state(false)

    let filterMenuOpen = $state(false)



    const filterRules = $derived(data.filterRules ?? createDefaultFilter())

    const totalTaskCount = $derived(data.totalTaskCount ?? data.tasks.length)

    const headerMenuOpen = $derived(sortMenuOpen || filterMenuOpen)

    const taskCountLabel = $derived(

        totalTaskCount !== data.tasks.length

            ? `${data.tasks.length}/${totalTaskCount} tasks`

            : `${data.tasks.length} tasks`,

    )



    function handleSortMenuOpenChange(open: boolean) {

        sortMenuOpen = open

    }



    function handleFilterMenuOpenChange(open: boolean) {

        filterMenuOpen = open

    }



    let resizeHeight = $state<number | null>(null)

    let committedHeight = $state<number | null>(null)



    const bodyHeight = $derived(

        resizeHeight

            ?? committedHeight

            ?? data.columnBodyHeight

            ?? DEFAULT_KANBAN_COLUMN_BODY_HEIGHT,

    )



    function handleResizePointerDown(event: PointerEvent) {

        event.preventDefault()

        event.stopPropagation()



        const startY = event.clientY

        const startHeight = bodyHeight



        function handlePointerMove(moveEvent: PointerEvent) {

            resizeHeight = Math.max(

                MIN_KANBAN_COLUMN_BODY_HEIGHT,

                startHeight + (moveEvent.clientY - startY),

            )

        }



        function handlePointerUp() {

            window.removeEventListener('pointermove', handlePointerMove)

            window.removeEventListener('pointerup', handlePointerUp)



            const finalHeight =

                resizeHeight

                ?? committedHeight

                ?? data.columnBodyHeight

                ?? DEFAULT_KANBAN_COLUMN_BODY_HEIGHT



            committedHeight = finalHeight

            resizeHeight = null

            data.onColumnBodyHeightChange?.(finalHeight)

        }



        window.addEventListener('pointermove', handlePointerMove)

        window.addEventListener('pointerup', handlePointerUp)

    }

</script>



<div

        class="kanban-column-node flex w-72 flex-col rounded-box border-2 bg-base-200/90 shadow-lg transition-shadow"

        class:z-50={headerMenuOpen}

        class:border-primary={data.isDropTarget}

        class:ring-2={data.isDropTarget}

        class:ring-primary={data.isDropTarget}

        class:border-base-300={!data.isDropTarget}

        data-status-id={id}

        style={data.statusColor ? `border-top: 3px solid ${data.statusColor}` : ''}

>

    <Handle type="target" position={Position.Top} id="connect-target-top" class="kanban-node-handle" />

    <Handle type="target" position={Position.Right} id="connect-target-right" class="kanban-node-handle" />

    <Handle type="target" position={Position.Bottom} id="connect-target-bottom" class="kanban-node-handle" />

    <Handle type="target" position={Position.Left} id="connect-target-left" class="kanban-node-handle" />

    <Handle type="source" position={Position.Top} id="connect-source-top" class="kanban-node-handle" />

    <Handle type="source" position={Position.Right} id="connect-source-right" class="kanban-node-handle" />

    <Handle type="source" position={Position.Bottom} id="connect-source-bottom" class="kanban-node-handle" />

    <Handle type="source" position={Position.Left} id="connect-source-left" class="kanban-node-handle" />



    <header class="overflow-visible border-b border-base-300 px-3 py-2">

        <div class="flex items-start justify-between gap-2">

            <div class="kanban-column-drag-handle min-w-0 flex-1 cursor-grab active:cursor-grabbing">

                <div class="flex items-center gap-1.5">

                    {#if data.isInitial}

                        <span class="tooltip tooltip-right" data-tip="Initial status">

                            <Flag class="h-3.5 w-3.5 shrink-0 text-warning" />

                        </span>

                    {/if}

                    {#if data.isTerminal}

                        <span class="tooltip tooltip-right" data-tip="Terminal status">

                            <CircleStop class="h-3.5 w-3.5 shrink-0 text-base-content/50" />

                        </span>

                    {/if}

                    <h2 class="truncate text-sm font-semibold">{data.label}</h2>

                </div>

                <p class="text-xs text-base-content/60">{taskCountLabel}</p>

            </div>



            {#if data.showControls !== false && data.onAddTask}

                <button

                        type="button"

                        class="btn btn-ghost btn-xs btn-square shrink-0"

                        title="Add task"

                        onclick={() => data.onAddTask?.(id)}

                >

                    <Plus class="h-3.5 w-3.5" />

                </button>

            {/if}

        </div>



        {#if data.showControls !== false}

            <div class="nodrag nopan mt-2 flex items-center gap-1">

                <KanbanFilterEditor

                        filter={filterRules}

                        disabled={data.filterDisabled}

                        disabledTitle="Using global column filter"

                        onChange={data.onFilterChange}

                        onOpenChange={handleFilterMenuOpenChange}

                />

                <ColumnSortEditor sortRules={data.sortRules} disabled={data.sortDisabled} disabledTitle="Using global column sort" onChange={data.onSortChange} onOpenChange={handleSortMenuOpenChange} />

            </div>

        {/if}

    </header>



    <div

            class="nodrag nopan flex flex-col gap-2 overflow-y-auto p-2"

            style:height="{bodyHeight}px"

    >

        {#each data.tasks as task (task.id)}

            <KanbanCard

                    {task}

                    domains={data.domains}

                    dimmed={Boolean(data.isTerminal)}

                    dragging={data.draggingTaskId === task.id}

                    onPointerDragStart={data.onPointerDragStart}

                    onClick={() => data.onCardClick?.(task)}

            />

        {/each}



        {#if data.tasks.length === 0}

            <div

                    class="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-base-300 px-3 py-6 text-center text-xs text-base-content/50"

            >

                {totalTaskCount > 0 ? 'No tasks match this column filter' : 'Drop tasks here'}

            </div>

        {/if}

    </div>



    <button

            type="button"

            class="nodrag nopan kanban-column-resize-handle"

            aria-label="Resize column height"

            onpointerdown={handleResizePointerDown}

    ></button>

</div>



<style>

    .kanban-column-node {

        position: relative;

    }



    :global(.kanban-node-handle) {

        width: 10px !important;

        height: 10px !important;

        min-width: 0 !important;

        min-height: 0 !important;

        opacity: 0;

        background: transparent !important;

        border: none !important;

        z-index: 2;

    }



    .kanban-column-resize-handle {

        display: block;

        width: 100%;

        height: 6px;

        margin: 0;

        padding: 0;

        border: none;

        border-top: 1px solid oklch(var(--bc) / 0.12);

        border-radius: 0 0 var(--rounded-box, 0.5rem) var(--rounded-box, 0.5rem);

        background: oklch(var(--b3) / 0.5);

        cursor: ns-resize;

        touch-action: none;

    }



    .kanban-column-resize-handle:hover,

    .kanban-column-resize-handle:active {

        background: oklch(var(--p) / 0.35);

    }

</style>


