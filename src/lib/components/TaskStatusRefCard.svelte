<script lang="ts">
    import { CircleStop, Flag } from 'lucide-svelte'

    import RefCardHoverPreview from '$lib/components/RefCardHoverPreview.svelte'
    import type { TaskStatusRecord } from '$lib/db/taskStatusMachine'
    import { refCardRootClass } from '$lib/components/refCardHover'
    import { mixDisplayColorInt } from '$lib/grid/colorUtils'

    let {
        status,
        class: className = '',
        onclick,
        hoverPreviewDisabled = false,
        fullWidth = false,
    }: {
        status: TaskStatusRecord
        class?: string
        onclick?: () => void
        hoverPreviewDisabled?: boolean
        fullWidth?: boolean
    } = $props()

    const borderColor = $derived(
        status.color != null ? mixDisplayColorInt(status.color) : null,
    )
    const cardBaseClass =
        'task-status-ref-card flex min-h-8 items-center gap-2 rounded border border-base-300 bg-base-100 px-2 py-1'
    const widthClass = $derived(fullWidth || className.includes('w-full') ? 'w-full' : '')
</script>

<RefCardHoverPreview disabled={hoverPreviewDisabled} anchorClass={widthClass}>
    {#snippet children(expanded)}
        <div
                class="{refCardRootClass(cardBaseClass, className, expanded)} {widthClass}"
                class:cursor-pointer={Boolean(onclick)}
                class:hover:shadow-sm={Boolean(onclick) && !expanded}
                class:flex-wrap={expanded}
                style:border-color={borderColor ?? undefined}
                style:background-color={status.color != null && borderColor
                    ? `color-mix(in srgb, ${borderColor} 12%, oklch(var(--b1)))`
                    : ''}
                data-status-id={status.id}
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
            <span
                    class="min-w-0 flex-1 text-sm font-medium leading-snug"
                    class:truncate={!expanded}
                    class:whitespace-normal={expanded}
            >{status.name}</span>
            {#if status.is_initial}
                <Flag class="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Initial status" />
            {/if}
            {#if status.is_terminal}
                <CircleStop class="h-3.5 w-3.5 shrink-0 text-base-content/50" aria-label="Terminal status" />
            {/if}
        </div>
    {/snippet}
</RefCardHoverPreview>