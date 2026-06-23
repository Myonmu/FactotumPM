<script lang="ts">
    import { Plus } from 'lucide-svelte'

    import DomainIconInline from '$lib/components/DomainIconInline.svelte'
    import KanbanCard from '$lib/components/kanban/KanbanCard.svelte'
    import type { DomainOption } from '$lib/db/dataView'
    import type { TaskRecord } from '$lib/db/dataView'
    import { UNASSIGNED_DOMAIN_ID, type DomainRecord } from '$lib/db/domains'
    import { mixDisplayColorInt, resolveDomainColor } from '$lib/grid/colorUtils'

    let {
        domain,
        domainOptions = [],
        tasks = [],
        totalTaskCount = tasks.length,
        dropHighlight = null,
        draggingTaskId = null,
        onHeaderClick,
        onPointerDragStart,
        onCardClick,
        onAddTask,
    }: {
        domain: DomainRecord | null
        domainOptions?: DomainOption[]
        tasks?: TaskRecord[]
        totalTaskCount?: number
        dropHighlight?: 'allowed' | null
        draggingTaskId?: string | null
        onHeaderClick?: () => void
        onPointerDragStart?: (event: PointerEvent, taskId: string) => void
        onCardClick?: (task: TaskRecord) => void
        onAddTask?: () => void
    } = $props()

    const columnId = $derived(domain?.id ?? UNASSIGNED_DOMAIN_ID)
    const columnTitle = $derived(domain?.name ?? 'Unassigned')
    const borderColor = $derived(
        domain ? mixDisplayColorInt(resolveDomainColor(domain.id, domainOptions), '') : null,
    )
    const taskCountLabel = $derived(
        totalTaskCount !== tasks.length
            ? `${tasks.length}/${totalTaskCount} tasks`
            : `${tasks.length} tasks`,
    )
</script>

<section
        class="domain-column flex h-full min-h-[24rem] w-72 shrink-0 flex-col rounded-box border border-base-300 bg-base-200/70 transition-shadow"
        class:ring-2={dropHighlight != null}
        class:ring-primary={dropHighlight === 'allowed'}
        data-domain-id={columnId}
>
    <header
            class="sticky top-0 z-10 border-b border-base-300 bg-base-200/95 px-3 py-2 backdrop-blur"
            style={borderColor ? `border-top: 3px solid ${borderColor}` : undefined}
    >
        <div class="flex items-start justify-between gap-2">
            <button
                    type="button"
                    class="flex min-w-0 flex-1 items-start gap-2 text-left hover:opacity-80"
                    disabled={!domain || !onHeaderClick}
                    onclick={() => onHeaderClick?.()}
            >
                {#if domain}
                    <DomainIconInline domainId={domain.id} domains={domainOptions} size={18} />
                {/if}
                <div class="min-w-0 flex-1">
                    <h2 class="truncate text-sm font-semibold">{columnTitle}</h2>
                    <p class="text-xs text-base-content/60">{taskCountLabel}</p>
                </div>
            </button>

            {#if onAddTask}
                <button
                        type="button"
                        class="btn btn-ghost btn-xs btn-square shrink-0"
                        title="Add task"
                        onclick={() => onAddTask?.()}
                >
                    <Plus class="h-3.5 w-3.5" />
                </button>
            {/if}
        </div>
    </header>

    <div class="domain-column-body flex flex-1 flex-col gap-2 overflow-y-auto p-2">
        {#each tasks as task (task.id)}
            <KanbanCard
                    {task}
                    domains={domainOptions}
                    dragging={draggingTaskId === task.id}
                    onPointerDragStart={onPointerDragStart}
                    onClick={() => onCardClick?.(task)}
            />
        {/each}

        {#if tasks.length === 0}
            <div
                    class="flex flex-1 items-center justify-center rounded-lg border border-dashed border-base-300 px-3 py-8 text-center text-xs text-base-content/50"
            >
                {totalTaskCount > 0 ? 'No tasks in this column' : 'Drop tasks here'}
            </div>
        {/if}
    </div>
</section>
