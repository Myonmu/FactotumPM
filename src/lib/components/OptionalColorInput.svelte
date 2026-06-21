<script lang="ts">
    import { tick } from 'svelte'

    import { colorHexToInt, colorIntToHex } from '$lib/grid/colorUtils'
    import { DEFAULT_STATUS_EDGE_COLOR_HEX } from '$lib/statusMachine/edgeColor'

    let {
        value = null,
        optional = true,
        emptyLabel = 'No color',
        autofocus = false,
        onChange,
        onClear,
    }: {
        value?: number | null
        optional?: boolean
        emptyLabel?: string
        autofocus?: boolean
        onChange?: (color: number) => void | Promise<void>
        onClear?: () => void | Promise<void>
    } = $props()

    let colorInputEl = $state<HTMLInputElement | null>(null)

    let colorHex = $derived(colorIntToHex(value) ?? DEFAULT_STATUS_EDGE_COLOR_HEX)
    let hasColor = $derived(value != null)

    async function handleInput(event: Event) {
        const hex = (event.currentTarget as HTMLInputElement).value
        const color = colorHexToInt(hex)
        if (color === null) return

        await onChange?.(color)
    }

    $effect(() => {
        if (!autofocus || !colorInputEl) return

        void tick().then(() => {
            colorInputEl?.focus({ preventScroll: true })

            try {
                colorInputEl?.showPicker()
            } catch {
                // showPicker is unavailable in some browsers/contexts
            }
        })
    })
</script>

<div class="flex items-center gap-2">
    <input
            bind:this={colorInputEl}
            class="h-10 w-14 cursor-pointer rounded border border-base-300 bg-base-100"
            type="color"
            value={colorHex}
            oninput={handleInput}
    />
    <span class="text-xs text-base-content/60">
        {#if hasColor}
            {colorHex}
        {:else}
            {emptyLabel}
        {/if}
    </span>
    {#if optional && hasColor}
        <button
                type="button"
                class="btn btn-xs btn-ghost ml-auto"
                onclick={() => onClear?.()}
        >
            Clear
        </button>
    {/if}
</div>
