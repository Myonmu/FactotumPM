<script lang="ts">
    import LucideIcon from '$lib/components/LucideIcon.svelte'
    import RefCardHoverPreview from '$lib/components/RefCardHoverPreview.svelte'
    import { formatAftermathLabel, type AftermathRecord } from '$lib/db/aftermath'
    import { refCardRootClass } from '$lib/components/refCardHover'
    import { mixDisplayColorInt } from '$lib/grid/colorUtils'

    let {
        aftermath,
        class: className = '',
        onclick,
        hoverPreviewDisabled = false,
    }: {
        aftermath: AftermathRecord
        class?: string
        onclick?: () => void
        hoverPreviewDisabled?: boolean
    } = $props()

    const label = $derived(formatAftermathLabel(aftermath))
    const borderColor = $derived(
        aftermath.color != null ? mixDisplayColorInt(aftermath.color) : null,
    )
    const cardBaseClass =
        'aftermath-ref-card flex min-h-8 items-center gap-2 rounded border border-base-300 bg-base-100 px-2 py-1'
</script>

<RefCardHoverPreview disabled={hoverPreviewDisabled}>
    {#snippet children(expanded)}
        <div
                class={refCardRootClass(cardBaseClass, className, expanded)}
                class:cursor-pointer={Boolean(onclick)}
                class:hover:shadow-sm={Boolean(onclick) && !expanded}
                class:flex-wrap={expanded}
                style:border-color={borderColor ?? undefined}
                data-aftermath-id={aftermath.id}
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
            <LucideIcon name={aftermath.icon} size={16} color={aftermath.color} />
            <span
                    class="min-w-0 flex-1 text-sm font-medium leading-snug"
                    class:truncate={!expanded}
                    class:whitespace-normal={expanded}
            >{label}</span>
            {#if aftermath.score != null}
                <span class="shrink-0 text-xs tabular-nums text-base-content/60">
                    {aftermath.score}/5
                </span>
            {/if}
        </div>
    {/snippet}
</RefCardHoverPreview>
