<script lang="ts">
    import { DateInput } from 'date-picker-svelte'

    let {
        value = $bindable<Date | null>(null),
        label = '',
        id = undefined,
        disabled = false,
        required = false,
        placeholder = 'yyyy-MM-dd HH:mm:ss',
    }: {
        value?: Date | null
        label?: string
        id?: string
        disabled?: boolean
        required?: boolean
        placeholder?: string
    } = $props()
</script>

<label class="form-control w-full">
    {#if label}
        <span class="label-text font-medium">{label}</span>
    {/if}

    <div class="datetime-field-host">
        <DateInput
                bind:value
                {id}
                {disabled}
                {required}
                {placeholder}
                format="yyyy-MM-dd HH:mm:ss"
                timePrecision="second"
                dynamicPositioning={true}
                class="input input-bordered w-full"
        />
    </div>
</label>

<style>
    .datetime-field-host {
        --date-picker-foreground: oklch(var(--bc));
        --date-picker-background: oklch(var(--b1));
        --date-picker-highlight-border: oklch(var(--p));
        --date-picker-highlight-shadow: color-mix(in oklch, oklch(var(--p)) 35%, transparent);
        --date-picker-selected-background: color-mix(in oklch, oklch(var(--p)) 22%, oklch(var(--b2)));
        --date-picker-selected-color: oklch(var(--bc));
        --date-picker-today-border: oklch(var(--bc) / 0.35);
        --date-input-width: 100%;
    }

    .datetime-field-host :global(.date-time-field) {
        width: 100%;
    }

    .datetime-field-host :global(.date-time-field input) {
        width: 100%;
        min-height: 2.5rem;
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
        border-radius: var(--rounded-btn, 0.5rem);
        border-color: oklch(var(--bc) / 0.2);
        background: oklch(var(--b1));
        color: oklch(var(--bc));
    }

    .datetime-field-host :global(.date-time-field input:focus) {
        border-color: oklch(var(--p));
        box-shadow: 0 0 0 2px color-mix(in oklch, oklch(var(--p)) 35%, transparent);
        outline: none;
    }

    .datetime-field-host :global(.date-time-field .picker) {
        z-index: 50;
    }

    .datetime-field-host :global(.date-time-picker) {
        border: 1px solid oklch(var(--bc) / 0.14);
        border-radius: var(--rounded-btn, 0.5rem);
        box-shadow: 0 4px 20px oklch(var(--bc) / 0.12);
    }
</style>
