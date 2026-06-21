<script lang="ts">
    import type { ICellProps } from '@svar-ui/svelte-grid'

    import { colorIntToHex } from '$lib/grid/colorUtils'

    let { row, column }: ICellProps = $props()

    let hex = $derived(colorIntToHex(row[column.id as string]))
</script>

{#if hex}
    <span class="inline-flex items-center gap-2">
        <span
                class="inline-block h-4 w-4 rounded border border-base-content/20"
                style="background-color: {hex}"
        ></span>
        <span>{hex}</span>
    </span>
{:else}
    <span class="text-base-content/40">—</span>
{/if}
