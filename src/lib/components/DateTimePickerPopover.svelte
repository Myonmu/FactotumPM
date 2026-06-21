<script lang="ts">
    import { DatePicker } from 'date-picker-svelte'
    import { tick, untrack } from 'svelte'

    import { bindPopoverDismiss } from '$lib/grid/popoverDismiss'
    import { formatDateToSql, parseDateTimeValue } from '$lib/grid/dateTimeUtils'

    type Anchor = {
        top: number
        left: number
        width: number
        height: number
    }

    let {
        anchor,
        initialValue = null,
        optional = false,
        onSelect,
        onClose,
    }: {
        anchor: Anchor
        initialValue?: unknown
        optional?: boolean
        onSelect?: (value: string | null) => void | Promise<void>
        onClose?: () => void
    } = $props()

    let popoverEl = $state<HTMLElement | null>(null)
    let selectedDate = $state<Date | null>(
        untrack(() => parseDateTimeValue(initialValue)),
    )

    const initialSql = untrack(() => {
        const parsed = parseDateTimeValue(initialValue)
        return parsed ? formatDateToSql(parsed) : null
    })

    let pendingCommit = $derived.by((): string | null | undefined => {
        const next = resolvePendingCommit(selectedDate)
        if (next === undefined) {
            return undefined
        }

        return next === initialSql ? undefined : next
    })

    let popoverStyle = $derived.by(() => {
        const width = 280
        const height = optional ? 340 : 310
        const margin = 8
        const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : width
        const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : height

        let left = anchor.left
        let top = anchor.top + anchor.height + margin

        if (left + width + margin > viewportWidth) {
            left = Math.max(margin, viewportWidth - width - margin)
        }

        if (top + height + margin > viewportHeight) {
            top = Math.max(margin, anchor.top - height - margin)
        }

        return `left:${left}px;top:${top}px;width:${width}px;`
    })

    function resolvePendingCommit(date: Date | null): string | null | undefined {
        if (date) {
            return formatDateToSql(date)
        }

        return optional ? null : undefined
    }

    async function flushCommit() {
        const value = pendingCommit
        if (value === undefined) return

        await onSelect?.(value)
    }

    async function clearDate() {
        if (!optional) return

        selectedDate = null
        await onSelect?.(null)
        onClose?.()
    }

    $effect(() => {
        if (!popoverEl) return

        const unbindDismiss = bindPopoverDismiss(() => popoverEl, () => onClose?.())

        void tick().then(() => {
            popoverEl?.focus({ preventScroll: true })
        })

        return () => {
            unbindDismiss()
            void flushCommit()
        }
    })
</script>

<div
        bind:this={popoverEl}
        class="datetime-picker-popover fixed z-50 rounded-box border border-base-300 bg-base-100 p-2 shadow-xl"
        style={popoverStyle}
        role="dialog"
        aria-modal="true"
        aria-label="Choose date and time"
        tabindex="-1"
>
    {#if optional}
        <div class="mb-2 flex justify-end">
            <button
                    type="button"
                    class="btn btn-ghost btn-xs"
                    onclick={() => clearDate()}
                    title="Clear date"
            >
                Clear
            </button>
        </div>
    {/if}

    <div class="datetime-picker-host">
        <DatePicker
                bind:value={selectedDate}
                timePrecision="second"
                initialBrowseDate={selectedDate ?? new Date()}
        />
    </div>
</div>

<style>
    .datetime-picker-host {
        --date-picker-foreground: oklch(var(--bc));
        --date-picker-background: oklch(var(--b1));
        --date-picker-highlight-border: oklch(var(--p));
        --date-picker-highlight-shadow: color-mix(in oklch, oklch(var(--p)) 35%, transparent);
        --date-picker-selected-background: color-mix(in oklch, oklch(var(--p)) 22%, oklch(var(--b2)));
        --date-picker-selected-color: oklch(var(--bc));
        --date-picker-today-border: oklch(var(--bc) / 0.35);
    }

    .datetime-picker-host :global(.date-time-picker) {
        width: 100%;
        border: 1px solid oklch(var(--bc) / 0.14);
        border-radius: var(--rounded-btn, 0.5rem);
        box-shadow: none;
        font-size: 0.8125rem;
        padding: 0.375rem;
    }

    .datetime-picker-host :global(.date-time-picker:focus) {
        border-color: oklch(var(--p));
        box-shadow: 0 0 0 2px color-mix(in oklch, oklch(var(--p)) 35%, transparent);
    }
</style>
