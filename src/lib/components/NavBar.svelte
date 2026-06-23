<script lang="ts">
    import {onMount} from "svelte";
    import {getPrefString, savePrefString} from "$lib/prefStore";
    import {PanelLeftOpen, PanelLeftClose} from "lucide-svelte";
    import {isAuthSuccess, logoutDb} from "$lib/auth.svelte";
    import ProjectSelector from "$lib/components/projects/ProjectSelector.svelte";

    let {onToggleSidebar, sideBarFolded} = $props();

    const themes = [
        "light",
        "dark",
        "cupcake",
        "bumblebee",
        "emerald",
        "corporate",
        "synthwave",
        "retro",
        "cyberpunk",
        "valentine",
        "halloween",
        "garden",
        "forest",
        "aqua",
        "lofi",
        "pastel",
        "fantasy",
        "wireframe",
        "black",
        "luxury",
        "dracula",
        "cmyk",
        "autumn",
        "business",
        "acid",
        "lemonade",
        "night",
        "coffee",
        "winter",
        "dim",
        "nord",
        "sunset",
    ]

    let currentTheme = $state("synthwave");
    const themePrefKey = "theme";

    function applyTheme(theme: string) {
        document.documentElement.setAttribute("data-theme", theme);
    }

    onMount(async () => {
        const saved = await getPrefString(themePrefKey);
        if (saved) {
            currentTheme = saved;
        }
        applyTheme(currentTheme);
    });

    async function changeTheme(theme: string) {
        currentTheme = theme;
        applyTheme(theme);
        await savePrefString(themePrefKey, theme);
    }

    async function handleLogout() {
        await logoutDb();
    }
</script>

<style> .AppName {
    font-family: ArcaneNine, sans-serif;
}
</style>

<nav class="navbar bg-base-100 sticky top-0 z-50">
    <div class="flex-1">
        {#if isAuthSuccess()}
            <button class="btn btn-sm btn-ghost" onclick={onToggleSidebar}>
                {#if sideBarFolded}
                    <PanelLeftOpen class="w-6 h-6"/>
                {:else}
                    <PanelLeftClose class="w-6 h-6"/>
                {/if}
            </button>
        {/if}
    </div>

    <div class="absolute left-1/2 transform -translate-x-1/2">
        <p class="font-extrabold text-4xl AppName"> FACTOTUM</p>
    </div>
    <!-- RIGHT SIDE -->
    <div class="flex-none flex items-center gap-2">
        {#if isAuthSuccess()}
            <button class="btn btn-sm btn-ghost" onclick={handleLogout}>
                Logout
            </button>
            <ProjectSelector />
        {/if}
        <div class="dropdown dropdown-end">
            <label tabindex="-1" class="btn btn-sm" for="dd">
                {currentTheme}
            </label>
            <div
                    id="dd"
                    tabindex="-1"
                    class="dropdown-content bg-base-100 text-base-content rounded-box top-px h-[30.5rem]
                    max-h-[calc(100vh-8.6rem)] overflow-y-auto border-[length:var(--border)]
                    border-white/5 shadow-2xl outline-[length:var(--border)] outline-black/5 mt-16"
            >
                <ul class="menu w-30">
                    {#each themes as theme}
                        <li>
                            <a onclick={() => changeTheme(theme)}>
                                {theme}
                            </a>
                        </li>
                    {/each}
                </ul>
            </div>
        </div>
    </div>
</nav>
