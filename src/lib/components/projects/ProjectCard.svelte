<script lang="ts">
    import { Anvil, ArrowRight, CheckSquare, Clock, Dices, Edit2, FolderKanban, Puzzle, Trash2, Trophy } from 'lucide-svelte'
    import { colorIntToHex } from '$lib/grid/colorUtils'
    import LucideIcon from '$lib/components/LucideIcon.svelte'
    import type { ProjectMetrics } from '$lib/db/projects'
    import { getCurrentProjectId, selectProject } from '$lib/projectState.svelte'
    import { formatDurationMs } from '$lib/trophy/trophyTime'

    let {
        project,
        onEdit,
        onDelete,
        preview = false,
    }: {
        project: ProjectMetrics
        onEdit?: (project: ProjectMetrics) => void
        onDelete?: (project: ProjectMetrics) => void
        preview?: boolean
    } = $props()

    const colorHex = $derived(project.color ? colorIntToHex(project.color) : null)
    const currentProjectId = $derived(getCurrentProjectId())
    const isCurrentProject = $derived(currentProjectId === project.id)
    const progress = $derived(
        project.task_count > 0
            ? Math.round((project.done_task_count / project.task_count) * 100)
            : 0,
    )

    async function handleOpen() {
        await selectProject(project.id)
    }
</script>

<div
    class="card bg-base-100 border border-base-300 shadow-sm transition-shadow"
    class:hover:shadow-md={!preview}
    class:pointer-events-none={preview}
    style:border-left-color={colorHex ?? undefined}
    style:border-left-width={colorHex ? '4px' : undefined}
>
    <div class="card-body p-4 gap-3">
        <!-- Header -->
        <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
                {#if project.icon}
                    <div class="shrink-0">
                        <LucideIcon name={project.icon} class="w-5 h-5" color={project.color} />
                    </div>
                {:else}
                    <span
                        class="inline-flex shrink-0"
                        style={colorHex ? `color: ${colorHex}` : undefined}
                    >
                        <FolderKanban class="w-5 h-5" />
                    </span>
                {/if}
                <h3 class="font-bold text-lg truncate">{project.name}</h3>
            </div>
            <div class="flex items-center gap-1 shrink-0">
                {#if !preview && onEdit}
                    <button
                            class="btn btn-xs btn-ghost btn-square"
                            onclick={() => onEdit(project)}
                            title="Edit project"
                    >
                        <Edit2 class="w-3.5 h-3.5" />
                    </button>
                {/if}
                {#if !preview && onDelete}
                    <button
                            class="btn btn-xs btn-ghost btn-square text-error hover:bg-error/10"
                            onclick={() => onDelete(project)}
                            title="Delete project"
                    >
                        <Trash2 class="w-3.5 h-3.5" />
                    </button>
                {/if}
            </div>
        </div>

        {#if project.description}
            <p class="text-sm text-base-content/60 line-clamp-2">{project.description}</p>
        {/if}

        <!-- Progress bar -->
        <div class="flex flex-col gap-1">
            <div class="flex justify-between text-xs text-base-content/60">
                <span>Progress</span>
                <span>{progress}%</span>
            </div>
            <progress
                class="progress progress-primary w-full h-2"
                value={progress}
                max="100"
            ></progress>
        </div>

        <div class="flex items-center justify-between text-xs">
            <span class="flex items-center gap-1 text-base-content/60">
                <Clock class="h-3 w-3 shrink-0" />
                Time spent
            </span>
            <span class="font-mono font-semibold tabular-nums">{formatDurationMs(project.time_spent_ms)}</span>
        </div>

        <!-- Metrics grid -->
        <div class="grid grid-cols-2 gap-2 text-sm">
            <div class="flex items-center gap-1.5 text-base-content/70">
                <CheckSquare class="w-4 h-4 shrink-0" />
                <span>{project.done_task_count}/{project.task_count} tasks</span>
            </div>
            <div class="flex items-center gap-1.5 text-base-content/70">
                <Trophy class="w-4 h-4 shrink-0 text-warning" />
                <span>{project.trophy_count} trophies</span>
            </div>
            {#if project.total_uncertainty}
                <div class="flex items-center gap-1.5 text-base-content/70">
                    <Dices class="w-4 h-4 shrink-0 text-primary" />
                    <span>Uncertainty {project.total_uncertainty}</span>
                </div>
            {/if}
            {#if project.total_effort}
                <div class="flex items-center gap-1.5 text-base-content/70">
                    <Anvil class="w-4 h-4 shrink-0 text-info" />
                    <span>Effort {project.total_effort}</span>
                </div>
            {/if}
            {#if project.total_complexity}
                <div class="flex items-center gap-1.5 text-base-content/70">
                    <Puzzle class="w-4 h-4 shrink-0 text-secondary" />
                    <span>Complexity {project.total_complexity}</span>
                </div>
            {/if}
        </div>

        {#if !preview && !isCurrentProject}
            <div class="card-actions justify-end mt-1">
                <button class="btn btn-sm btn-primary gap-1" onclick={handleOpen}>
                    Open
                    <ArrowRight class="w-3.5 h-3.5" />
                </button>
            </div>
        {/if}
    </div>
</div>
