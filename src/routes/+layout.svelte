<script lang="ts">
    import '../app.css';
    import NavBar from "$lib/components/NavBar.svelte";
    import LeftPanel from "$lib/components/LeftPanel.svelte";
    import {isAuthSuccess} from "$lib/auth.svelte";
    let isLeftPanelFolded = $state(false);
    let { children } = $props();
    function toggleSideBar(){
        isLeftPanelFolded = !isLeftPanelFolded;
    }
    let mainDisplace = $derived(isAuthSuccess() && !isLeftPanelFolded ? "ml-16" : "ml-0");
</script>

<div class="min-h-screen flex flex-col bg-base-200">

    <NavBar onToggleSidebar={toggleSideBar} sideBarFolded={isLeftPanelFolded} />

    <div class="flex flex-1">

        {#if isAuthSuccess()}
            <LeftPanel folded={isLeftPanelFolded}/>
        {/if}

        <main class={`flex-1 h-full overflow-auto transition-all duration-300 ${mainDisplace}`}>
            {@render children()}
        </main>

    </div>
</div>