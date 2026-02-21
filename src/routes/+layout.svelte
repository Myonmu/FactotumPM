<script lang="ts">
    import '../app.css';
    import NavBar from "$lib/components/NavBar.svelte";

    let { children } = $props();
</script>

<div class="min-h-screen flex flex-col bg-base-200">
    <NavBar />

    <main class="flex-1">
        {@render children()}
    </main>
</div>