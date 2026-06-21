<script lang="ts">
    import {Trophy} from "lucide-svelte";

    let { value = $bindable() } = $props();

    function toggle() {
        value = value ? 0 : 1;
    }
</script>

<button
        type="button"
        class="hover:opacity-60 transition"
        class:opacity-100={value}
        class:opacity-20={!value}
        onclick={toggle}
>
    <Trophy class="align-middle" color="oklch(var(--p))" />
</button>