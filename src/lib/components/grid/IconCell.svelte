<script lang="ts">
    import { getContext } from 'svelte'
    import type { ICellProps } from '@svar-ui/svelte-grid'

    import LucideIcon from '$lib/components/LucideIcon.svelte'
    import { resolveRowIconColor } from '$lib/grid/colorUtils'
    import {
        DATA_TABLE_GRID_CONTEXT,
        type DataTableGridContext,
    } from '$lib/grid/dataTableGridContext'

    let { row, column }: ICellProps = $props()

    const gridContext = getContext<DataTableGridContext>(DATA_TABLE_GRID_CONTEXT)

    let iconName = $derived(row[column.id as string] as string | null | undefined)
    let iconColor = $derived(
        resolveRowIconColor(row, gridContext.tableName, gridContext.rows),
    )
</script>

{#if iconName}
    <span class="inline-flex items-center gap-2">
        <LucideIcon name={iconName} size={16} color={iconColor} class="shrink-0" />
        <span class="truncate text-sm">{iconName}</span>
    </span>
{:else}
    <span class="text-base-content/40">—</span>
{/if}
