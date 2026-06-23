<script lang="ts">
    import { onMount } from 'svelte'

    import ProjectCard from '$lib/components/projects/ProjectCard.svelte'
    import { loadProjectMetricsById, type ProjectRef } from '$lib/db/projects'

    let {
        project,
    }: {
        project: ProjectRef
    } = $props()

    let metrics = $state<Awaited<ReturnType<typeof loadProjectMetricsById>>>(null)

    onMount(() => {
        void loadProjectMetricsById(project.id).then((entry) => {
            metrics = entry
        })
    })
</script>

<div class="project-ref-card-preview w-80 max-w-full shadow-lg">
    {#if metrics}
        <ProjectCard project={metrics} preview />
    {:else}
        <div class="flex min-h-32 items-center justify-center rounded-box border border-base-300 bg-base-100">
            <span class="loading loading-spinner loading-sm text-primary"></span>
        </div>
    {/if}
</div>
