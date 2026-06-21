<script lang="ts">
    import { resolveLucideIcon } from '$lib/icons/lucideIconRegistry'
    import { colorIntToHex } from '$lib/grid/colorUtils'

    let {
        name = null,
        size = 16,
        color = null,
        class: className = '',
    }: {
        name?: string | null
        size?: number
        color?: number | null
        class?: string
    } = $props()

    let IconComponent = $derived(resolveLucideIcon(name))
    let colorHex = $derived(colorIntToHex(color))
</script>

{#if IconComponent}
    <span
            class="inline-flex shrink-0 {className}"
            style={colorHex ? `color: ${colorHex}` : undefined}
    >
        <IconComponent {size} />
    </span>
{:else if name}
    <span class="truncate text-xs text-base-content/50" title="Unknown icon: {name}">{name}</span>
{/if}