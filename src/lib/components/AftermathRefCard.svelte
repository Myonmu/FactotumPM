<script lang="ts">
    import LucideIcon from '$lib/components/LucideIcon.svelte'
    import { formatAftermathLabel, type AftermathRecord } from '$lib/db/aftermath'
    import { mixDisplayColorInt } from '$lib/grid/colorUtils'

    let {
        aftermath,
        class: className = '',
        onclick,
    }: {
        aftermath: AftermathRecord
        class?: string
        onclick?: () => void
    } = $props()

    const label = $derived(formatAftermathLabel(aftermath))
    const borderColor = $derived(
        aftermath.color != null ? mixDisplayColorInt(aftermath.color) : null,
    )
</script>

<div
        class="aftermath-ref-card flex min-h-8 items-center gap-2 rounded border border-base-300 bg-base-100 px-2 py-1 {className}"
        class:cursor-pointer={Boolean(onclick)}
        class:hover:shadow-sm={Boolean(onclick)}
        style:border-color={borderColor ?? undefined}
        data-aftermath-id={aftermath.id}
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
    <LucideIcon name={aftermath.icon} size={16} color={aftermath.color} />
    <span class="min-w-0 flex-1 truncate text-sm font-medium leading-none">{label}</span>
    {#if aftermath.score != null}
        <span class="shrink-0 text-xs tabular-nums text-base-content/60">
            {aftermath.score}/5
        </span>
    {/if}
</div>
