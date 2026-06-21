<script lang="ts">
    import { Trophy } from 'lucide-svelte'

    let {
        colors = ['#eab308'],
        size = 28,
        radiant = false,
        strokeWidth = 2,
    }: {
        colors?: string[]
        size?: number
        radiant?: boolean
        strokeWidth?: number
    } = $props()

    const primary = $derived(colors[0] ?? '#eab308')
    const secondary = $derived(colors[1] ?? null)
</script>

<span
        class="trophy-icon"
        class:radiant
        style:width="{size}px"
        style:height="{size}px"
        style:--glow={primary}
>
    <Trophy size={size} color={primary} {strokeWidth} absoluteStrokeWidth />
    {#if secondary}
        <span class="trophy-icon-split" style:width="{size}px" style:height="{size}px">
            <Trophy size={size} color={secondary} {strokeWidth} absoluteStrokeWidth />
        </span>
    {/if}
</span>

<style>
    .trophy-icon {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    .trophy-icon-split {
        position: absolute;
        inset: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        /* Reveal only the right half so the two colors meet in the middle. */
        clip-path: inset(0 0 0 50%);
    }

    .trophy-icon.radiant {
        filter: drop-shadow(0 0 5px var(--glow)) drop-shadow(0 0 10px var(--glow));
        animation: trophy-radiant 2.4s ease-in-out infinite;
    }

    @keyframes trophy-radiant {
        0%,
        100% {
            filter: drop-shadow(0 0 4px var(--glow)) drop-shadow(0 0 8px var(--glow));
        }
        50% {
            filter: drop-shadow(0 0 8px var(--glow)) drop-shadow(0 0 16px var(--glow));
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .trophy-icon.radiant {
            animation: none;
        }
    }
</style>
