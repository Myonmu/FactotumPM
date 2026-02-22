<script lang="ts">
    import {onMount} from "svelte";
    import {getPrefString, savePrefString} from "$lib/prefStore";
    import {PanelLeftOpen, PanelLeftClose} from "lucide-svelte";
    import {isAuthSuccess} from "$lib/auth.svelte";

    const themes = [
        'light',
        'dark',
        'cupcake',
        'bumblebee',
        'emerald',
        'corporate',
        'synthwave',
        'retro',
        'cyberpunk',
        'valentine',
        'halloween',
        'garden',
        'forest',
        'aqua',
        'lofi',
        'pastel',
        'fantasy',
        'wireframe',
        'black',
        'luxury',
        'dracula',
        'cmyk',
        'autumn',
        'business',
        'acid',
        'lemonade',
        'night',
        'coffee',
        'winter',
        'dim',
        'nord',
        'sunset',
        'caramellatte',
    ]

    let currentTheme = $state("synthwave");
    let leftPanelOpened = $state(false);
    const themePrefKey = "theme";

    function toggleLeftPanel() {
        leftPanelOpened = !leftPanelOpened;
    }

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
</script>

<nav class="navbar bg-base-100 sticky top-0 z-50">
    <div class="flex-1">
        {#if isAuthSuccess()}
            <button class="btn btn-sm" onclick={toggleLeftPanel}>
                {#if leftPanelOpened}
                    <PanelLeftClose class="w-5 h-5"/>
                {:else}
                    <PanelLeftOpen class="w-5 h-5"/>
                {/if}
            </button>
        {/if}
    </div>

    <!-- RIGHT SIDE -->
    <div class="flex-none">
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