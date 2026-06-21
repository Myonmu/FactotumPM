<script lang="ts">
    let {
        label,
        active = false,
        onclick,
    } = $props<{
        label: string
        active?: boolean
        onclick?: () => void
    }>()
</script>

<button
        type="button"
        class="btn btn-sm shadow-md transition-all"
        class:btn-primary={active}
        class:btn-ghost={!active}
        class:bg-base-100={!active}
        {onclick}
>
    {label}
</button>
