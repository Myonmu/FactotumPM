<script lang="ts">
    import { Clock } from 'lucide-svelte'
    import { onMount } from 'svelte'

    import type { DomainOption } from '$lib/db/dataView'
    import { mixDisplayColorInt, resolveDomainColor } from '$lib/grid/colorUtils'
    import { ensureSessionTimeMaps, getDomainTimeMs } from '$lib/sessionTime.svelte'
    import { formatDurationMs } from '$lib/trophy/trophyTime'

    let {
        domain,
        domains = [],
        class: className = '',
    }: {
        domain: Pick<DomainOption, 'id' | 'title'>
        domains?: DomainOption[]
        class?: string
    } = $props()

    const domainColor = $derived(resolveDomainColor(domain.id, domains))
    const borderColor = $derived(
        domainColor != null ? mixDisplayColorInt(domainColor) : null,
    )
    const timeSpentMs = $derived(getDomainTimeMs(domain.id))

    onMount(() => {
        void ensureSessionTimeMaps()
    })
</script>

<div
        class="domain-ref-chip flex min-h-8 items-center gap-2 rounded border border-base-300 bg-base-100 px-2 py-1 {className}"
        style:border-color={borderColor ?? undefined}
>
    <span class="min-w-0 flex-1 truncate text-sm font-medium leading-none">{domain.title}</span>
    {#if timeSpentMs > 0}
        <span class="badge badge-ghost badge-xs gap-0.5 px-1 shrink-0" title="Time spent">
            <Clock class="h-2.5 w-2.5 shrink-0" color="oklch(var(--bc))" />
            {formatDurationMs(timeSpentMs)}
        </span>
    {/if}
</div>
