<script lang="ts">
    import { getSessionDisplayTitle, type SessionRecord } from '$lib/db/sessions'
    import { formatSessionRelativeTime } from '$lib/calendar/sessionRelativeTime'
    import type { DomainOption } from '$lib/db/dataView'
    import DomainIconInline from '$lib/components/DomainIconInline.svelte'
    import RefCardHoverPreview from '$lib/components/RefCardHoverPreview.svelte'
    import TaskRefInline from '$lib/components/TaskRefInline.svelte'
    import TaskRefCardPreview from '$lib/components/TaskRefCardPreview.svelte'
    import { refCardRootClass } from '$lib/components/refCardHover'
    import { mixDisplayColorInt, resolveTaskColor } from '$lib/grid/colorUtils'

    let {
        session,
        domains = [],
        now = new Date(),
        class: className = '',
        onclick,
        hoverPreviewDisabled = false,
    }: {
        session: SessionRecord
        domains?: DomainOption[]
        now?: Date
        class?: string
        onclick?: () => void
        hoverPreviewDisabled?: boolean
    } = $props()

    const soleTask = $derived(session.tasks.length === 1 ? session.tasks[0] : null)
    const primaryDomainId = $derived(session.tasks[0]?.domain_id ?? null)
    const title = $derived(getSessionDisplayTitle(session))
    const relativeTime = $derived(formatSessionRelativeTime(session, now))
    const borderColor = $derived(
        soleTask
            ? mixDisplayColorInt(resolveTaskColor(soleTask, domains), '')
            : mixDisplayColorInt(session.task_color),
    )
    const backgroundTint = $derived(
        soleTask ? resolveTaskColor(soleTask, domains) : session.task_color,
    )
    const cardBaseClass =
        'session-ref-card flex min-h-8 items-center gap-2 rounded border border-base-300 bg-base-100 px-2 py-1'
</script>

<RefCardHoverPreview disabled={hoverPreviewDisabled}>
    {#snippet children(expanded)}
        {#if expanded && soleTask}
            <TaskRefCardPreview task={soleTask} {domains} />
        {:else}
            <div
                    class={refCardRootClass(cardBaseClass, className, expanded)}
                    class:cursor-pointer={Boolean(onclick)}
                    class:hover:shadow-sm={Boolean(onclick) && !expanded}
                    class:transition-shadow={Boolean(onclick) && !expanded}
                    class:flex-wrap={expanded}
                    style:border-color={borderColor}
                    style:background-color={backgroundTint != null
                        ? `color-mix(in srgb, ${borderColor} 12%, oklch(var(--b1)))`
                        : ''}
                    data-session-id={session.id}
                    role={onclick && !expanded ? 'button' : undefined}
                    tabindex={onclick && !expanded ? 0 : undefined}
                    onclick={expanded ? undefined : onclick}
                    onkeydown={(event) => {
                        if (expanded || !onclick) return
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            onclick()
                        }
                    }}
            >
                {#if soleTask}
                    <TaskRefInline task={soleTask} {domains} {expanded} />
                {:else}
                    <span
                            class="flex min-w-0 flex-1 items-center gap-2"
                            class:flex-wrap={expanded}
                    >
                        <DomainIconInline domainId={primaryDomainId} {domains} />
                        <span
                                class="min-w-0 flex-1 text-sm font-medium leading-snug"
                                class:truncate={!expanded}
                                class:whitespace-normal={expanded}
                        >{title}</span>
                    </span>
                {/if}

                {#if relativeTime}
                    <span
                            class="shrink-0 text-xs tabular-nums text-base-content/60"
                            class:w-full={expanded}
                            class:text-right={expanded}
                    >{relativeTime}</span>
                {/if}
            </div>
        {/if}
    {/snippet}
</RefCardHoverPreview>
