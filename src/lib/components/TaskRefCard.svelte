<script lang="ts">
    import type { DomainOption, TaskRef } from '$lib/db/dataView'
    import RefCardHoverPreview from '$lib/components/RefCardHoverPreview.svelte'
    import TaskRefInline from '$lib/components/TaskRefInline.svelte'
    import TaskRefCardPreview from '$lib/components/TaskRefCardPreview.svelte'
    import { refCardRootClass } from '$lib/components/refCardHover'
    import { mixDisplayColorInt, resolveTaskColor } from '$lib/grid/colorUtils'

    let {
        task,
        domains = [],
        class: className = '',
        onclick,
        hoverPreviewDisabled = false,
    }: {
        task: TaskRef
        domains?: DomainOption[]
        class?: string
        onclick?: () => void
        hoverPreviewDisabled?: boolean
    } = $props()

    const taskColor = $derived(resolveTaskColor(task, domains))
    const taskBorderColor = $derived(mixDisplayColorInt(taskColor, ''))
    const cardBaseClass =
        'task-ref-card flex min-h-8 items-center gap-2 rounded border border-base-300 bg-base-100 px-2 py-1'
</script>

<RefCardHoverPreview disabled={hoverPreviewDisabled}>
    {#snippet children(expanded)}
        {#if expanded}
            <TaskRefCardPreview {task} {domains} />
        {:else}
            <div
                    class={refCardRootClass(cardBaseClass, className, expanded)}
                    class:cursor-pointer={Boolean(onclick)}
                    class:hover:shadow-sm={Boolean(onclick)}
                    class:transition-shadow={Boolean(onclick)}
                    style:border-color={taskBorderColor}
                    style:background-color={taskColor != null
                        ? `color-mix(in srgb, ${taskBorderColor} 12%, oklch(var(--b1)))`
                        : ''}
                    data-task-id={task.id}
                    role={onclick ? 'button' : undefined}
                    tabindex={onclick ? 0 : undefined}
                    onclick={onclick}
                    onkeydown={(event) => {
                        if (!onclick) return
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            onclick()
                        }
                    }}
            >
                <TaskRefInline {task} {domains} />
            </div>
        {/if}
    {/snippet}
</RefCardHoverPreview>
