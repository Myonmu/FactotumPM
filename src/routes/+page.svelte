<script lang="ts">
    import AuthPanel from "$lib/components/AuthPanel.svelte";
    import DbSelectorPanel from "$lib/components/DbSelectorPanel.svelte";
</script>

<main
    class="flex h-full min-h-0 flex-col items-center justify-center gap-8 p-6 lg:flex-row lg:gap-10"
>
    <aside class="order-2 w-full max-w-xs shrink-0 lg:order-1">
        <DbSelectorPanel />
    </aside>

    <div class="order-1 w-full max-w-md shrink-0 lg:order-2">
        <AuthPanel landingPage="/dashboard" />
    </div>

    <div
        class="order-3 hidden w-full max-w-xs shrink-0 lg:block"
        aria-hidden="true"
    ></div>
</main>
