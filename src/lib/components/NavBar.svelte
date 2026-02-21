<script lang="ts">
    import {onMount} from "svelte";
    import {getSavedTheme, saveTheme, applyTheme} from "$lib/themeStore";

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
        'abyss',
        'silk'
    ]

    let currentTheme = "synthwave";

    onMount(async () => {
        const saved = await getSavedTheme();
        if (saved) {
            currentTheme = saved;
        }
        applyTheme(currentTheme);
    });

    async function changeTheme(theme: string) {
        currentTheme = theme;
        applyTheme(theme);
        await saveTheme(theme);
    }
</script>

<nav class="navbar bg-base-100 sticky top-0 z-50">
    <div class="flex-1">
        <a class="btn btn-ghost text-xl">FACTOTUM</a>
    </div>

    <!-- RIGHT SIDE -->
    <div class="flex-none">
        <div class="dropdown dropdown-end">
            <label tabindex="0" class="btn btn-sm">
                {currentTheme}
            </label>
            <div
                    tabindex="0"
                    class="dropdown-content bg-base-100 text-base-content rounded-box top-px h-[30.5rem]
                    max-h-[calc(100vh-8.6rem)] overflow-y-auto border-[length:var(--border)]
                    border-white/5 shadow-2xl outline-[length:var(--border)] outline-black/5 mt-16"
            >
                <ul class="menu w-30">
                {#each themes as theme}
                    <li>
                        <a on:click={() => changeTheme(theme)}>
                            {theme}
                        </a>
                    </li>
                {/each}
            </div>
        </div>
    </div>
</nav>