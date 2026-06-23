<script lang="ts">
    import { afterNavigate } from '$app/navigation';
    import '../app.css';
    import NavBar from "$lib/components/NavBar.svelte";
    import LeftPanel from "$lib/components/LeftPanel.svelte";
    import {isAuthSuccess, checkAuthSuccess} from "$lib/auth.svelte";
    import { initProjectState, resetProjectState } from "$lib/projectState.svelte";
    import {onMount} from "svelte";
    import HostPanel from "$lib/components/HostPanel.svelte";
    import ToastHost from '$lib/components/ToastHost.svelte'
    import { closeInspector, getInspectorState } from '$lib/inspector.svelte'

    let isLeftPanelFolded = $state(false);
    let { children } = $props();

    function toggleSideBar(){
        isLeftPanelFolded = !isLeftPanelFolded;
        sessionStorage.setItem("isLeftPanelFolded", isLeftPanelFolded ? "true" : "false");
    }

    let mainDisplace = $derived(isAuthSuccess() && !isLeftPanelFolded ? "ml-16" : "ml-0");

    onMount(async () => {
        isLeftPanelFolded = sessionStorage.getItem("isLeftPanelFolded") == "true";
        await checkAuthSuccess();
    })

    $effect(() => {
        if (isAuthSuccess()) {
            void initProjectState()
        } else {
            resetProjectState()
        }
    })

    afterNavigate(() => {
        closeInspector();
    });
</script>

<div class="flex h-screen flex-col overflow-hidden bg-base-200">

    <NavBar onToggleSidebar={toggleSideBar} sideBarFolded={isLeftPanelFolded} />

    <div class="flex min-h-0 flex-1">

        {#if isAuthSuccess()}
            <LeftPanel folded={isLeftPanelFolded}/>
        {/if}

        <main class={`flex min-h-0 flex-1 flex-col overflow-auto transition-all duration-300 ${mainDisplace}`}>
            {@render children()}
        </main>

        {#if getInspectorState().visible && getInspectorState().component}
            {@const inspector = getInspectorState()}
            <HostPanel
                    title={inspector.title}
                    component={inspector.component}
                    componentProps={inspector.componentProps}
                    visible={inspector.visible}
                    onClose={closeInspector}
            />
        {/if}

    </div>

    <ToastHost />
</div>
