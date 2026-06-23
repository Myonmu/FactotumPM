<script lang="ts">
    import LucideIcon from '$lib/components/LucideIcon.svelte'
    import {
        resolveDomainColor,
        resolveDomainIcon,
        type DomainColorNode,
    } from '$lib/grid/colorUtils'

    let {
        domainId = null,
        domains = [],
        size = 16,
        class: className = '',
    }: {
        domainId?: string | null
        domains?: DomainColorNode[]
        size?: number
        class?: string
    } = $props()

    const icon = $derived(resolveDomainIcon(domainId, domains))
    const color = $derived(resolveDomainColor(domainId, domains))
</script>

{#if icon}
    <LucideIcon name={icon} {size} {color} class={className} />
{/if}
