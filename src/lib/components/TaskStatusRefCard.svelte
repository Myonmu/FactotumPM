<script lang="ts">
    import { CircleStop, Flag } from 'lucide-svelte'

    import type { TaskStatusRecord } from '$lib/db/taskStatusMachine'
    import { mixDisplayColorInt } from '$lib/grid/colorUtils'

    let {
        status,
        class: className = '',
        onclick,
    }: {
        status: TaskStatusRecord
        class?: string
        onclick?: () => void
    } = $props()

    const borderColor = $derived(
        status.color != null ? mixDisplayColorInt(status.color) : null,
    )
</script>

<div
        class="task-status-ref-card flex min-h-8 items-center gap-2 rounded border border-base-300 bg-base-100 px-2 py-1 {className}"
        class:cursor-pointer={Boolean(onclick)}
        class:hover:shadow-sm={Boolean(onclick)}
        style:border-color={borderColor ?? undefined}
        style:background-color={status.color != null && borderColor
            ? `color-mix(in srgb, ${borderColor} 12%, oklch(var(--b1)))`
            : ''}
        data-status-id={status.id}
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
    <span class="min-w-0 flex-1 truncate text-sm font-medium leading-none">{status.name}</span>
    {#if status.is_initial === 1}
        <Flag class="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Initial status" />
    {/if}
    {#if status.is_terminal === 1}
        <CircleStop class="h-3.5 w-3.5 shrink-0 text-base-content/50" aria-label="Terminal status" />
    {/if}
</div>
