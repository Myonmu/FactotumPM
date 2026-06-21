<script lang="ts">
    import { getSessionDisplayTitle, type SessionRecord } from '$lib/db/sessions'
    import { formatSessionRelativeTime } from '$lib/calendar/sessionRelativeTime'
    import type { DomainOption } from '$lib/db/dataView'
    import TaskRefInline from '$lib/components/TaskRefInline.svelte'
    import { mixDisplayColorInt, resolveTaskColor } from '$lib/grid/colorUtils'

    let {
        session,
        domains = [],
        now = new Date(),
        class: className = '',
        onclick,
    }: {
        session: SessionRecord
        domains?: DomainOption[]
        now?: Date
        class?: string
        onclick?: () => void
    } = $props()

    const soleTask = $derived(session.tasks.length === 1 ? session.tasks[0] : null)
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
</script>

<div
        class="session-ref-card flex min-h-8 items-center gap-2 rounded border border-base-300 bg-base-100 px-2 py-1 {className}"
        class:cursor-pointer={Boolean(onclick)}
        class:hover:shadow-sm={Boolean(onclick)}
        class:transition-shadow={Boolean(onclick)}
        style:border-color={borderColor}
        style:background-color={backgroundTint != null
            ? `color-mix(in srgb, ${borderColor} 12%, oklch(var(--b1)))`
            : ''}
        data-session-id={session.id}
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
    {#if soleTask}
        <TaskRefInline task={soleTask} {domains} />
    {:else}
        <span class="min-w-0 flex-1 truncate text-sm font-medium leading-none">{title}</span>
    {/if}

    {#if relativeTime}
        <span class="shrink-0 text-xs tabular-nums text-base-content/60">{relativeTime}</span>
    {/if}
</div>
