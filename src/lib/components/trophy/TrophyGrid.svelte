<script lang="ts">
    import TrophyCard from '$lib/components/trophy/TrophyCard.svelte'
    import type { DomainOption } from '$lib/db/dataView'
    import type { TrophyView } from '$lib/trophy/computeTrophies'
    import type { TrophyGroup } from '$lib/trophy/groupTrophies'

    let {
        groups,
        domains = [],
        onTrophyClick,
    }: {
        groups: TrophyGroup[]
        domains?: DomainOption[]
        onTrophyClick?: (view: TrophyView) => void
    } = $props()
</script>

<div class="flex flex-col gap-6">
    {#each groups as group (group.key)}
        <section class="flex flex-col gap-3">
            {#if group.label}
                <div class="flex items-center gap-3">
                    <h2 class="text-sm font-semibold uppercase tracking-wide text-base-content/70">
                        {group.label}
                    </h2>
                    <span class="badge badge-ghost badge-sm">{group.views.length}</span>
                    <div class="h-px flex-1 bg-base-300"></div>
                </div>
            {/if}

            <div class="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3">
                {#each group.views as view (view.task.id)}
                    <TrophyCard {view} {domains} onClick={() => onTrophyClick?.(view)} />
                {/each}
            </div>
        </section>
    {/each}
</div>
