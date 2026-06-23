<script lang="ts">
    import { Clock } from 'lucide-svelte'
    import { onMount } from 'svelte'

    import DomainIconInline from '$lib/components/DomainIconInline.svelte'
    import RefCardHoverPreview from '$lib/components/RefCardHoverPreview.svelte'
    import type { DomainOption } from '$lib/db/dataView'
    import { refCardRootClass } from '$lib/components/refCardHover'
    import { mixDisplayColorInt, resolveDomainColor } from '$lib/grid/colorUtils'
    import { ensureSessionTimeMaps, getDomainTimeMs } from '$lib/sessionTime.svelte'
    import { formatDurationMs } from '$lib/trophy/trophyTime'

    let {
        domain,
        domains = [],
        class: className = '',
        hoverPreviewDisabled = false,
    }: {
        domain: Pick<DomainOption, 'id' | 'title'>
        domains?: DomainOption[]
        class?: string
        hoverPreviewDisabled?: boolean
    } = $props()

    const domainColor = $derived(resolveDomainColor(domain.id, domains))
    const borderColor = $derived(
        domainColor != null ? mixDisplayColorInt(domainColor) : null,
    )
    const timeSpentMs = $derived(getDomainTimeMs(domain.id))
    const cardBaseClass =
        'domain-ref-chip flex min-h-8 items-center gap-2 rounded border border-base-300 bg-base-100 px-2 py-1'

    onMount(() => {
        void ensureSessionTimeMaps()
    })
</script>

<RefCardHoverPreview disabled={hoverPreviewDisabled}>
    {#snippet children(expanded)}
        <div
                class={refCardRootClass(cardBaseClass, className, expanded)}
                class:flex-wrap={expanded}
                style:border-color={borderColor ?? undefined}
        >
            <DomainIconInline domainId={domain.id} {domains} />
            <span
                    class="min-w-0 flex-1 text-sm font-medium leading-snug"
                    class:truncate={!expanded}
                    class:whitespace-normal={expanded}
            >{domain.title}</span>
            {#if timeSpentMs > 0}
                <span class="badge badge-ghost badge-xs shrink-0 gap-0.5 px-1" title="Time spent">
                    <Clock class="h-2.5 w-2.5 shrink-0" color="oklch(var(--bc))" />
                    {formatDurationMs(timeSpentMs)}
                </span>
            {/if}
        </div>
    {/snippet}
</RefCardHoverPreview>
