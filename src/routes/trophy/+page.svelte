<script lang="ts">
    import TrophyBoard from '$lib/components/trophy/TrophyBoard.svelte'
</script>

<div class="flex h-full min-h-0 flex-col bg-base-200">
    <div class="sticky top-0 z-30 border-b border-base-300 bg-base-200/95 px-4 py-3 backdrop-blur">
        <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
                <h1 class="text-2xl font-bold">Trophies</h1>
                <p class="mt-1 text-sm text-base-content/60">
                    Milestones earned from your tasks. Size, type and progression are derived from
                    contributing tasks. Click a trophy to chart its route.
                </p>
            </div>
        </div>
    </div>

    <div class="flex min-h-0 flex-1 flex-col p-4">
        <TrophyBoard />
    </div>
</div>
