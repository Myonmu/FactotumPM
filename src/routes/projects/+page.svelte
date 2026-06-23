<script lang="ts">
    import ProjectBoard from '$lib/components/projects/ProjectBoard.svelte'
</script>

<div class="flex h-full min-h-0 flex-col bg-base-200">
    <div class="sticky top-0 z-30 border-b border-base-300 bg-base-200/95 px-4 py-3 backdrop-blur">
        <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
                <h1 class="text-2xl font-bold">Projects</h1>
                <p class="mt-1 text-sm text-base-content/60">
                    Organize your tasks, sessions and trophies into projects. Track progress and metrics per project.
                </p>
            </div>
        </div>
    </div>

    <div class="flex min-h-0 flex-1 flex-col p-4 overflow-y-auto">
        <ProjectBoard />
    </div>
</div>
