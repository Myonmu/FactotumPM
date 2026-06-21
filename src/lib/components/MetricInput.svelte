<script lang="ts">
    import { Shell, Star } from 'lucide-svelte'

    let {
        label,
        value = $bindable<number | null>(null),
        canEstimate = $bindable<number | null>(null),
        min = 0,
        max = 10,
        disabled = false,
        toggleable = false,
        help = '',
    } = $props()

    let unknown = $derived(toggleable && canEstimate !== 1)
    let sliderValue = $derived(value ?? Math.round((min + max) / 2))
    let isSingleValue = $derived(min === max)

    function toggleUnknown() {
        if (!toggleable || disabled) return

        if (canEstimate === 1) {
            canEstimate = 0
            value = null
            return
        }

        canEstimate = 1
        value = value ?? Math.round((min + max) / 2)
    }

    function pinUnknown() {
        if (!toggleable || disabled) return
        canEstimate = 0
        value = null
    }

    function handleSliderInput(event: Event) {
        const target = event.currentTarget as HTMLInputElement
        value = Number(target.value)
        if (toggleable) {
            canEstimate = 1
        }
    }

    function handleNumberInput(event: Event) {
        const target = event.currentTarget as HTMLInputElement
        const parsed = Number(target.value)
        value = Number.isNaN(parsed) ? null : parsed
        if (toggleable && value != null) {
            canEstimate = 1
        }
    }
</script>

<div class="space-y-1 opacity-90 {disabled ? 'opacity-50' : ''}">
    <div class="flex items-center gap-2">
        <span class="font-medium text-sm">{label}</span>

        {#if help}
            <span class="tooltip" data-tip={help}>?</span>
        {/if}

        {#if toggleable}
            <button
                type="button"
                onclick={toggleUnknown}
                class="text-sm transition-opacity"
                aria-label={unknown ? 'Mark as estimable' : 'Cannot estimate for now'}
                disabled={disabled}
            >
                {#if unknown}
                    <Shell size={14} />
                {:else}
                    <Star size={14} />
                {/if}
            </button>
        {/if}
    </div>

    {#if toggleable && unknown}
        {#if canEstimate === 0}
            <div class="text-sm italic opacity-60">
                Can't estimate for now
            </div>
        {:else}
            <button
                type="button"
                class="text-left text-sm italic opacity-60 hover:opacity-100"
                onclick={pinUnknown}
                disabled={disabled}
            >
                Can't estimate for now
            </button>
        {/if}
    {:else}
        <div class="flex items-center gap-2">
            {#if isSingleValue}
                <input
                    type="number"
                    class="input input-sm w-24"
                    value={value ?? ''}
                    oninput={handleNumberInput}
                    min={min}
                    max={max}
                    disabled={disabled}
                />
            {:else}
                <input
                    type="range"
                    class="range range-sm flex-1"
                    value={sliderValue}
                    oninput={handleSliderInput}
                    min={min}
                    max={max}
                    disabled={disabled}
                />
                <span class="text-sm w-6 text-right">{value ?? '?'}</span>
            {/if}
        </div>
    {/if}
</div>
