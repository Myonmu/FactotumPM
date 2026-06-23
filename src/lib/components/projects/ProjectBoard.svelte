<script lang="ts">
    import { onMount } from 'svelte'
    import { Plus, AlertTriangle, RefreshCw } from 'lucide-svelte'
    import ProjectCard from './ProjectCard.svelte'
    import ProjectEditor from './ProjectEditor.svelte'
    import { loadProjectMetrics, type ProjectMetrics } from '$lib/db/projects'
    import { closeInspector, openInspector, updateInspectorProps } from '$lib/inspector.svelte'
    import { updateCurrentProject, deleteProjectAndReset, createAndSelectProject } from '$lib/projectState.svelte'

    let projects = $state<ProjectMetrics[]>([])
    let loading = $state(true)
    let error = $state<string | null>(null)
    let actionLoading = $state(false)

    let deletingProject = $state<ProjectMetrics | null>(null)
    let deleteConfirmText = $state('')
    let deleteLoading = $state(false)

    async function load() {
        loading = true
        error = null
        try {
            projects = await loadProjectMetrics()
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to load projects'
        } finally {
            loading = false
        }
    }

    onMount(() => void load())

    async function createAndInspectProject() {
        actionLoading = true
        error = null

        try {
            const created = await createAndSelectProject({ name: 'New project' })
            await load()
            const metrics = projects.find((entry) => entry.id === created.id) ?? {
                ...created,
                task_count: 0,
                trophy_count: 0,
                done_task_count: 0,
                total_effort: null,
                total_complexity: null,
                total_uncertainty: null,
                time_spent_ms: 0,
            }
            openProjectInspector(metrics)
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to create project'
        } finally {
            actionLoading = false
        }
    }

    function openProjectInspector(project: ProjectMetrics) {
        openInspector(
            ProjectEditor,
            {
                project,
                saving: actionLoading,
                onSave: (patch) => handleProjectSave(project.id, patch),
                onDelete: () => handleProjectDeleteRequest(project),
                onCancel: closeInspector,
            },
            'Project Inspector',
        )
    }

    async function handleProjectSave(
        projectId: string,
        patch: {
            name: string
            description: string | null
            color: number | null
            icon: string | null
        },
    ) {
        actionLoading = true
        updateInspectorProps({ saving: true })

        try {
            await updateCurrentProject(projectId, patch)
            projects = projects.map((entry) =>
                entry.id === projectId ? { ...entry, ...patch } : entry,
            )
            const updated = projects.find((entry) => entry.id === projectId)
            if (updated) {
                updateInspectorProps({ project: updated })
            }
        } finally {
            actionLoading = false
            updateInspectorProps({ saving: false })
        }
    }

    function handleProjectDeleteRequest(project: ProjectMetrics) {
        closeInspector()
        openDelete(project)
    }

    async function handleDeleteConfirm() {
        if (!deletingProject) return
        deleteLoading = true
        try {
            await deleteProjectAndReset(deletingProject.id)
            deletingProject = null
            deleteConfirmText = ''
            await load()
        } finally {
            deleteLoading = false
        }
    }

    function openDelete(proj: ProjectMetrics) {
        deletingProject = proj
        deleteConfirmText = ''
    }

    const deleteConfirmValid = $derived(
        deleteConfirmText.trim().toLowerCase() === deletingProject?.name.toLowerCase(),
    )
</script>

{#if loading}
    <div class="flex min-h-48 items-center justify-center">
        <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>
{:else if error}
    <div class="alert alert-error">
        <span>{error}</span>
        <button class="btn btn-sm btn-ghost" onclick={load}>
            <RefreshCw class="w-4 h-4" /> Retry
        </button>
    </div>
{:else if projects.length === 0}
    <div class="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div class="opacity-40">
            <svg class="w-16 h-16 mx-auto" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="8" y="16" width="48" height="36" rx="4" />
                <path d="M8 24h48M24 16l4-8h8l4 8" />
            </svg>
        </div>
        <div>
            <p class="text-lg font-semibold">No projects yet</p>
            <p class="text-sm text-base-content/60 mt-1">
                Create a project to organize your tasks, sessions and trophies.
            </p>
        </div>
        <button
                class="btn btn-primary gap-2"
                disabled={actionLoading}
                onclick={() => void createAndInspectProject()}
        >
            <Plus class="w-4 h-4" />
            Create first project
        </button>
    </div>
{:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each projects as proj (proj.id)}
            <ProjectCard
                project={proj}
                onEdit={openProjectInspector}
                onDelete={openDelete}
            />
        {/each}

        <button
                class="card bg-base-100 border border-dashed border-base-300 hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer min-h-40 flex items-center justify-center"
                disabled={actionLoading}
                onclick={() => void createAndInspectProject()}
        >
            <div class="flex flex-col items-center gap-2 text-base-content/40 hover:text-primary transition-colors">
                <Plus class="w-8 h-8" />
                <span class="text-sm font-medium">New project</span>
            </div>
        </button>
    </div>
{/if}

{#if deletingProject}
    <div class="modal modal-open">
        <div class="modal-box max-w-md">
            <div class="flex items-center gap-3 mb-4 text-error">
                <AlertTriangle class="w-6 h-6 shrink-0" />
                <h3 class="font-bold text-lg">Delete project</h3>
            </div>

            <div class="flex flex-col gap-3">
                <p class="text-sm">
                    This will <strong>permanently delete</strong> the project
                    <strong>"{deletingProject.name}"</strong>.
                    Tasks, sessions and other items assigned to this project will become
                    unassigned (not deleted).
                </p>
                <div class="alert alert-warning py-2 text-sm">
                    <AlertTriangle class="w-4 h-4 shrink-0" />
                    <span>This action cannot be undone.</span>
                </div>
                <div class="form-control gap-1">
                    <label class="label py-0">
                        <span class="label-text text-sm">
                            Type <strong>{deletingProject.name}</strong> to confirm:
                        </span>
                    </label>
                    <input
                            class="input input-bordered input-error w-full"
                            placeholder={deletingProject.name}
                            bind:value={deleteConfirmText}
                    />
                </div>
            </div>

            <div class="modal-action mt-4">
                <button
                        class="btn btn-ghost"
                        onclick={() => { deletingProject = null; deleteConfirmText = '' }}
                        disabled={deleteLoading}
                >
                    Cancel
                </button>
                <button
                        class="btn btn-error"
                        onclick={handleDeleteConfirm}
                        disabled={!deleteConfirmValid || deleteLoading}
                >
                    {#if deleteLoading}
                        <span class="loading loading-spinner loading-sm"></span>
                    {/if}
                    Delete project
                </button>
            </div>
        </div>
        <div
                class="modal-backdrop"
                onclick={() => { deletingProject = null; deleteConfirmText = '' }}
                role="presentation"
        ></div>
    </div>
{/if}
