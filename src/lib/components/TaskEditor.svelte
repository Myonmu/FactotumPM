<script lang="ts">
    import MetricInput from '$lib/components/MetricInput.svelte';
    import DomainSearchableSelect from '$lib/components/DomainSearchableSelect.svelte';
    import SearchableSelect from '$lib/components/SearchableSelect.svelte';
    import TaskChildTree from '$lib/components/TaskChildTree.svelte';
    import TaskRefCard from '$lib/components/TaskRefCard.svelte';
    import TaskSearchableSelect from '$lib/components/TaskSearchableSelect.svelte';
    import TaskEditorDetailTab from '$lib/components/TaskEditorDetailTab.svelte';
    import TaskEditorSessionsTab from '$lib/components/TaskEditorSessionsTab.svelte';
    import TableTab from '$lib/components/TableTab.svelte';
    import TrophyToggle from '$lib/components/TrophyToggle.svelte';
    import {
        addTaskDependency,
        assignTaskParent,
        buildTaskChildTree,
        collectAncestorIds,
        collectDescendantIds,
        getExplicitTaskDependencies,
        getImplicitTaskDependencies,
        removeTaskDependency,
        type TaskDependencyEdge,
        type TaskHierarchyItem,
        type TaskRef,
        type DomainOption,
    } from '$lib/db/dataView';
    import { getStatusTransitionActions } from '$lib/db/taskStatusMachine';
    import { mixDisplayColorInt, resolveTaskColor, colorIntToHex, colorHexToInt } from '$lib/grid/colorUtils';
    import { Anvil, ArrowRight, Dices, Puzzle, Trash2, Unlink } from "lucide-svelte";

    type TaskShape = {
        id: string
        title: string
        description: string | null
        detail: string | null
        uncertainty: number | null
        uncertainty_can_estimate: number | null
        complexity: number | null
        complexity_can_estimate: number | null
        effort: number | null
        effort_can_estimate: number | null
        domain_id: string | null
        color?: number | null
        parent_task_id: string | null
        is_trophy: number | null
        task_status_id: string | null
    }

    type DomainItem = DomainOption
    type TaskItem = TaskRef
    type StatusItem = { id: string; title: string; is_initial?: boolean; color?: number | null }
    type StatusEdge = {
        id: string
        from_status_id: string
        to_status_id: string
        action: string | null
        color?: number | null
    }

    let {
        task,
        domains = [],
        tasks = [],
        statuses = [],
        statusEdges = [],
        taskDependencies = [],
        hasChildren = false,
        onSave,
        onDelete,
        onChildrenChange,
        onDependenciesChange,
        onInspectTask,
    }: {
        task: TaskShape
        domains?: DomainItem[]
        tasks?: TaskItem[]
        statuses?: StatusItem[]
        statusEdges?: StatusEdge[]
        taskDependencies?: TaskDependencyEdge[]
        hasChildren?: boolean
        onSave?: (task: TaskShape) => void | Promise<void>
        onDelete?: (taskId: string) => void | Promise<void>
        onChildrenChange?: () => void | Promise<void>
        onDependenciesChange?: () => void | Promise<void>
        onInspectTask?: (taskId: string) => void | Promise<void>
    } = $props();

    type ChildViewMode = 'direct' | 'recursive'
    type DependencyViewMode = 'explicit' | 'implicit'
    type EditorTab = 'basics' | 'detail' | 'children' | 'dependencies' | 'sessions'

    let activeTab = $state<EditorTab>('basics')

    let localTask = $state<TaskShape>(cloneTask(task));
    let loadedTaskId = $state(task.id)
    let lastSyncedPropStatusId = $state<string | null>(task.task_status_id)
    let saveTimer: ReturnType<typeof setTimeout> | undefined
    let skipAutoSave = false
    let showDeleteConfirm = $state(false)
    let deleting = $state(false)
    let applyingTransition = $state(false)
    let childViewMode = $state<ChildViewMode>('direct')
    let dependencyViewMode = $state<DependencyViewMode>('explicit')
    let childLinkBusy = $state(false)
    let dependencyLinkBusy = $state(false)
    let addChildSelection = $state('')
    let addDependencySelection = $state('')

    const tasksById = $derived(new Map(tasks.map((item) => [item.id, item])))

    const taskHierarchy = $derived(
        tasks.map((item) => ({
            id: item.id,
            title: item.title,
            parent_task_id: item.parent_task_id,
        })),
    )

    const directChildren = $derived(
        taskHierarchy
            .filter((item) => item.parent_task_id === task.id)
            .sort((a, b) => a.title.localeCompare(b.title)),
    )

    const childTree = $derived(buildTaskChildTree(task.id, taskHierarchy))

    const taskColor = $derived(resolveTaskColor(localTask, domains))
    const taskBorderColor = $derived(mixDisplayColorInt(taskColor, ''))
    const taskColorPickerValue = $derived(
        colorIntToHex(localTask.color ?? taskColor) ?? '#808080',
    )
    const usesDomainColor = $derived(localTask.color == null)

    const statusActions = $derived(
        getStatusTransitionActions(localTask.task_status_id, statusEdges, statuses)
    );

    const effectiveHasChildren = $derived(directChildren.length > 0 || hasChildren)

    const deleteDisabledReason = $derived(
        effectiveHasChildren ? 'Remove or reassign subtasks before deleting this task.' : null
    );

    const displayedChildren = $derived(
        directChildren.map((child) => ({ task: child, depth: 1 })),
    )

    const eligibleChildTasks = $derived.by(() => {
        const directChildIds = new Set(directChildren.map((child) => child.id))
        const descendantIds = collectDescendantIds(task.id, taskHierarchy)

        return tasks.filter((candidate) => {
            if (candidate.id === task.id) return false
            if (directChildIds.has(candidate.id)) return false
            if (descendantIds.has(candidate.id)) return false
            return true
        })
    })

    const explicitDependencies = $derived(
        getExplicitTaskDependencies(task.id, taskDependencies),
    )

    const implicitDependencies = $derived(
        getImplicitTaskDependencies(task.id, taskHierarchy, taskDependencies),
    )

    const ancestorIds = $derived(collectAncestorIds(task.id, taskHierarchy))

    const prerequisiteTaskIds = $derived(
        new Set(
            explicitDependencies
                .filter((edge) => edge.from_task_id === task.id)
                .map((edge) => edge.to_task_id),
        ),
    )

    const eligibleDependencyTasks = $derived.by(() => {
        const descendantIds = collectDescendantIds(task.id, taskHierarchy)

        return tasks.filter((candidate) => {
            if (candidate.id === task.id) return false
            if (prerequisiteTaskIds.has(candidate.id)) return false
            if (descendantIds.has(candidate.id)) return false
            return true
        })
    })

    function taskRefForChild(item: TaskHierarchyItem): TaskRef {
        const found = tasksById.get(item.id)
        if (found) return found

        return {
            id: item.id,
            title: item.title,
            parent_task_id: item.parent_task_id,
            domain_id: null,
            color: null,
            is_trophy: null,
            uncertainty: null,
            uncertainty_can_estimate: null,
            complexity: null,
            complexity_can_estimate: null,
            effort: null,
            effort_can_estimate: null,
        }
    }

    function cloneTask(source: TaskShape): TaskShape {
        return { ...source, detail: source.detail ?? null }
    }

    async function addExistingChild(childTaskId: string) {
        if (!childTaskId || childLinkBusy) return

        childLinkBusy = true

        try {
            await assignTaskParent(childTaskId, task.id)
            await onChildrenChange?.()
        } finally {
            childLinkBusy = false
        }
    }

    async function removeChildLink(childTaskId: string) {
        if (!childTaskId || childLinkBusy) return

        childLinkBusy = true

        try {
            await assignTaskParent(childTaskId, null)
            await onChildrenChange?.()
        } finally {
            childLinkBusy = false
        }
    }

    function handleAddChildSelected(childTaskId: string) {
        if (!childTaskId || childLinkBusy) return
        addChildSelection = ''
        void addExistingChild(childTaskId)
    }

    function dependencyViaLabel(edge: TaskDependencyEdge): string | null {
        const involvedAncestors = [edge.from_task_id, edge.to_task_id].filter((taskId) =>
            ancestorIds.has(taskId),
        )
        if (involvedAncestors.length === 0) return null

        const labels = involvedAncestors
            .map((taskId) => tasksById.get(taskId)?.title ?? taskId)
            .filter(Boolean)

        return labels.length > 0 ? labels.join(', ') : null
    }

    async function addExistingDependency(prerequisiteTaskId: string) {
        if (!prerequisiteTaskId || dependencyLinkBusy) return

        dependencyLinkBusy = true

        try {
            await addTaskDependency(task.id, prerequisiteTaskId)
            await onDependenciesChange?.()
        } finally {
            dependencyLinkBusy = false
        }
    }

    async function removeDependencyLink(dependencyId: string) {
        if (!dependencyId || dependencyLinkBusy) return

        dependencyLinkBusy = true

        try {
            await removeTaskDependency(dependencyId)
            await onDependenciesChange?.()
        } finally {
            dependencyLinkBusy = false
        }
    }

    function handleAddDependencySelected(prerequisiteTaskId: string) {
        if (!prerequisiteTaskId || dependencyLinkBusy) return
        addDependencySelection = ''
        void addExistingDependency(prerequisiteTaskId)
    }

    $effect(() => {
        if (task.id !== loadedTaskId) {
            localTask = cloneTask(task)
            loadedTaskId = task.id
            lastSyncedPropStatusId = task.task_status_id
            skipAutoSave = true
            return
        }

        if (task.task_status_id !== lastSyncedPropStatusId) {
            lastSyncedPropStatusId = task.task_status_id
            if (task.task_status_id !== localTask.task_status_id) {
                localTask = { ...localTask, task_status_id: task.task_status_id }
                skipAutoSave = true
            }
        }
    })

    async function save() {
        const payload = {
            ...localTask,
            complexity: localTask.complexity,
            effort: localTask.effort,
        }

        await onSave?.(payload)
    }

    async function confirmDelete() {
        if (!onDelete || deleting || effectiveHasChildren) return

        deleting = true

        try {
            await onDelete(localTask.id)
            showDeleteConfirm = false
        } finally {
            deleting = false
        }
    }

    async function applyTransition(toStatusId: string) {
        if (applyingTransition || localTask.task_status_id === toStatusId) return

        applyingTransition = true
        clearTimeout(saveTimer)

        try {
            skipAutoSave = true
            localTask = { ...localTask, task_status_id: toStatusId }
            await save()
        } finally {
            applyingTransition = false
        }
    }

    $effect(() => {
        if (!onSave) return

        const _snapshot = JSON.stringify(localTask)

        if (skipAutoSave) {
            skipAutoSave = false
            return
        }

        clearTimeout(saveTimer)
        saveTimer = setTimeout(() => {
            void save()
        }, 400)

        return () => {
            clearTimeout(saveTimer)
        }
    })
</script>

<div
        class="card bg-base-100 shadow-xl border border-base-200"
        style:border-color={taskBorderColor}>

    <div class="card-body space-y-4">

        <div class="flex items-center gap-4">
            <input
                    class="input input-bordered text-xl font-semibold flex-1"
                    bind:value={localTask.title}
                    placeholder="Task title"
            />

            <TrophyToggle bind:value={localTask.is_trophy}/>
        </div>

        <textarea
                class="textarea textarea-bordered w-full"
                bind:value={localTask.description}
                placeholder="Description"
        />

        <div class="flex flex-wrap gap-2">
            <TableTab label="Basics" active={activeTab === 'basics'} onclick={() => (activeTab = 'basics')} />
            <TableTab label="Detail" active={activeTab === 'detail'} onclick={() => (activeTab = 'detail')} />
            <TableTab label="Children" active={activeTab === 'children'} onclick={() => (activeTab = 'children')} />
            <TableTab
                    label="Dependencies"
                    active={activeTab === 'dependencies'}
                    onclick={() => (activeTab = 'dependencies')}
            />
            <TableTab label="Sessions" active={activeTab === 'sessions'} onclick={() => (activeTab = 'sessions')} />
        </div>

        {#if activeTab === 'basics'}
        <div class="grid gap-4 @md:grid-cols-3">
            <div class="flex items-end gap-2">
                <Dices class="shrink-0" size={24} color="oklch(var(--p))"/>
                <div class="flex-1">
                    <MetricInput
                            label="Uncertainty"
                            bind:value={localTask.uncertainty}
                            bind:canEstimate={localTask.uncertainty_can_estimate}
                            toggleable
                            help="How unclear is the method?"
                    />
                </div>
            </div>

            <div class="flex items-end gap-2">
                <Puzzle class="shrink-0" size={24} color="oklch(var(--s))"/>
                <div class="flex-1">
                    <MetricInput
                            label="Complexity"
                            bind:value={localTask.complexity}
                            bind:canEstimate={localTask.complexity_can_estimate}
                            disabled={effectiveHasChildren}
                            toggleable
                            help="How intellectually demanding?"
                    />
                </div>
            </div>

            <div class="flex items-end gap-2">
                <Anvil class="shrink-0" size={24} color="oklch(var(--a))"/>
                <div class="flex-1">
                    <MetricInput
                            label="Effort"
                            bind:value={localTask.effort}
                            bind:canEstimate={localTask.effort_can_estimate}
                            toggleable
                            help="Work payload magnitude"
                    />
                </div>
            </div>
        </div>

        <div class="grid gap-4 @md:grid-cols-2">
            <DomainSearchableSelect
                    label="Domain"
                    {domains}
                    bind:value={localTask.domain_id as string}
                    placeholder="Select domain..."
                    group="task-inspector"
            />

            <TaskSearchableSelect
                    label="Parent Task"
                    tasks={tasks.filter((candidate) => candidate.id !== localTask.id)}
                    bind:value={localTask.parent_task_id as string}
                    {domains}
                    placeholder="Select parent task..."
                    group="task-inspector"
            />
        </div>

        <label class="form-control w-full">
            <span class="label-text font-medium">Task color</span>
            <div class="flex flex-wrap items-center gap-2">
                <input
                        type="color"
                        class="h-10 w-14 cursor-pointer rounded border border-base-300 bg-base-100 p-1"
                        value={taskColorPickerValue}
                        oninput={(event) => {
                            const hex = (event.currentTarget as HTMLInputElement).value
                            localTask = {
                                ...localTask,
                                color: colorHexToInt(hex),
                            }
                        }}
                />
                <span class="text-sm text-base-content/70">
                    {#if usesDomainColor}
                        Using domain color
                    {:else}
                        Custom color
                    {/if}
                </span>
                {#if !usesDomainColor}
                    <button
                            type="button"
                            class="btn btn-ghost btn-xs"
                            onclick={() => {
                                localTask = { ...localTask, color: null }
                            }}
                    >
                        Use domain color
                    </button>
                {/if}
            </div>
        </label>

        <SearchableSelect
                label="Status"
                items={statuses}
                bind:value={localTask.task_status_id as string}
                placeholder="Select status..."
                group="task-inspector"
        />

        {#if statusActions.length > 0}
            <div class="space-y-2">
                <span class="text-sm font-medium">Actions</span>
                <div class="flex flex-wrap gap-2">
                    {#each statusActions as action (action.edgeId ?? action.toStatusId)}
                        <button
                                type="button"
                                class="btn btn-sm btn-outline"
                                disabled={applyingTransition || localTask.task_status_id === action.toStatusId}
                                style="border-color: {action.colorHex}; color: {action.colorHex};"
                                onclick={() => applyTransition(action.toStatusId)}
                        >
                            {action.label}
                        </button>
                    {/each}
                </div>
            </div>
        {/if}

        {#if onDelete}
            <div class="card-actions justify-start">
                <button
                        type="button"
                        class="btn btn-error btn-outline gap-2"
                        disabled={deleting || effectiveHasChildren}
                        title={deleteDisabledReason ?? undefined}
                        onclick={() => (showDeleteConfirm = true)}
                >
                    <Trash2 class="h-4 w-4" />
                    Delete Task
                </button>
            </div>
        {/if}
        {:else if activeTab === 'detail'}
            {#key localTask.id}
                <TaskEditorDetailTab
                        value={localTask.detail}
                        onChange={(detail) => {
                            localTask = { ...localTask, detail }
                        }}
                />
            {/key}
        {:else if activeTab === 'children'}
        <div class="space-y-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-sm font-medium">Child Tasks</span>
                <div class="join">
                    <button
                            type="button"
                            class="btn btn-xs join-item"
                            class:btn-active={childViewMode === 'direct'}
                            onclick={() => (childViewMode = 'direct')}
                    >
                        Direct
                    </button>
                    <button
                            type="button"
                            class="btn btn-xs join-item"
                            class:btn-active={childViewMode === 'recursive'}
                            onclick={() => (childViewMode = 'recursive')}
                    >
                        Recursive
                    </button>
                </div>
            </div>

            <div class="max-h-48 min-h-12 overflow-y-auto rounded-lg border border-base-300 bg-base-100 p-2">
                {#if childViewMode === 'recursive'}
                    {#if childTree.length === 0}
                        <div class="px-1 py-3 text-sm text-base-content/50">No child tasks</div>
                    {:else}
                        <TaskChildTree
                                nodes={childTree}
                                {domains}
                                taskRefForChild={taskRefForChild}
                                childLinkBusy={childLinkBusy}
                                onInspectTask={onInspectTask}
                                onUnlink={(taskId) => void removeChildLink(taskId)}
                        />
                    {/if}
                {:else if displayedChildren.length === 0}
                    <div class="px-1 py-3 text-sm text-base-content/50">No child tasks</div>
                {:else}
                    <div class="space-y-1">
                        {#each displayedChildren as item (item.task.id)}
                            {@const childRef = taskRefForChild(item.task)}
                            {@const canUnlink = item.task.parent_task_id === task.id}
                            <div class="flex items-center gap-2">
                                <div class="min-w-0 flex-1">
                                    <TaskRefCard
                                            task={childRef}
                                            {domains}
                                            onclick={onInspectTask ? () => onInspectTask(item.task.id) : undefined}
                                    />
                                </div>
                                {#if canUnlink}
                                    <button
                                            type="button"
                                            class="btn btn-ghost btn-xs btn-square shrink-0"
                                            title="Remove parent-child link"
                                            disabled={childLinkBusy}
                                            onclick={() => void removeChildLink(item.task.id)}
                                    >
                                        <Unlink class="h-3.5 w-3.5" />
                                    </button>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>

            {#if childViewMode === 'direct'}
                <TaskSearchableSelect
                        label="Add child task"
                        tasks={eligibleChildTasks}
                        bind:value={addChildSelection}
                        onSelect={handleAddChildSelected}
                        {domains}
                        placeholder="Select existing task..."
                        group="task-inspector-children"
                />
            {/if}
        </div>
        {:else if activeTab === 'dependencies'}
        <div class="space-y-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-sm font-medium">Dependencies</span>
                <div class="join">
                    <button
                            type="button"
                            class="btn btn-xs join-item"
                            class:btn-active={dependencyViewMode === 'explicit'}
                            onclick={() => (dependencyViewMode = 'explicit')}
                    >
                        Explicit
                    </button>
                    <button
                            type="button"
                            class="btn btn-xs join-item"
                            class:btn-active={dependencyViewMode === 'implicit'}
                            onclick={() => (dependencyViewMode = 'implicit')}
                    >
                        Implicit
                    </button>
                </div>
            </div>

            <div class="max-h-48 min-h-12 overflow-y-auto rounded-lg border border-base-300 bg-base-100 p-2">
                {#if dependencyViewMode === 'explicit'}
                    {#if explicitDependencies.length === 0}
                        <div class="px-1 py-3 text-sm text-base-content/50">No explicit dependencies</div>
                    {:else}
                        <div class="space-y-2">
                            {#each explicitDependencies as edge (edge.id)}
                                {@const fromRef = taskRefForChild({
                                    id: edge.from_task_id,
                                    title: tasksById.get(edge.from_task_id)?.title ?? edge.from_task_id,
                                    parent_task_id: tasksById.get(edge.from_task_id)?.parent_task_id ?? null,
                                })}
                                {@const toRef = taskRefForChild({
                                    id: edge.to_task_id,
                                    title: tasksById.get(edge.to_task_id)?.title ?? edge.to_task_id,
                                    parent_task_id: tasksById.get(edge.to_task_id)?.parent_task_id ?? null,
                                })}
                                {@const isOutgoing = edge.from_task_id === task.id}
                                <div class="flex items-start gap-2">
                                    <div class="min-w-0 flex-1 space-y-1">
                                        <div class="text-xs text-base-content/60">
                                            {#if isOutgoing}
                                                Depends on
                                            {:else}
                                                Required by
                                            {/if}
                                        </div>
                                        <div class="flex flex-wrap items-center gap-2">
                                            {#if isOutgoing}
                                                <div class="min-w-0 flex-1">
                                                    <TaskRefCard
                                                            task={toRef}
                                                            {domains}
                                                            onclick={onInspectTask ? () => onInspectTask(toRef.id) : undefined}
                                                    />
                                                </div>
                                            {:else}
                                                <div class="min-w-0 flex-1">
                                                    <TaskRefCard
                                                            task={fromRef}
                                                            {domains}
                                                            onclick={onInspectTask ? () => onInspectTask(fromRef.id) : undefined}
                                                    />
                                                </div>
                                            {/if}
                                        </div>
                                    </div>
                                    <button
                                            type="button"
                                            class="btn btn-ghost btn-xs btn-square shrink-0"
                                            title="Remove dependency"
                                            disabled={dependencyLinkBusy}
                                            onclick={() => void removeDependencyLink(edge.id)}
                                    >
                                        <Unlink class="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            {/each}
                        </div>
                    {/if}
                {:else if implicitDependencies.length === 0}
                    <div class="px-1 py-3 text-sm text-base-content/50">No implicit dependencies</div>
                {:else}
                    <div class="space-y-2">
                        {#each implicitDependencies as edge (edge.id)}
                            {@const fromRef = taskRefForChild({
                                id: edge.from_task_id,
                                title: tasksById.get(edge.from_task_id)?.title ?? edge.from_task_id,
                                parent_task_id: tasksById.get(edge.from_task_id)?.parent_task_id ?? null,
                            })}
                            {@const toRef = taskRefForChild({
                                id: edge.to_task_id,
                                title: tasksById.get(edge.to_task_id)?.title ?? edge.to_task_id,
                                parent_task_id: tasksById.get(edge.to_task_id)?.parent_task_id ?? null,
                            })}
                            {@const viaLabel = dependencyViaLabel(edge)}
                            <div class="space-y-1 rounded-md border border-base-200 p-2">
                                {#if viaLabel}
                                    <div class="text-xs text-base-content/60">Via {viaLabel}</div>
                                {/if}
                                <div class="flex flex-wrap items-center gap-2">
                                    <div class="min-w-0 flex-1">
                                        <TaskRefCard
                                                task={fromRef}
                                                {domains}
                                                onclick={onInspectTask ? () => onInspectTask(fromRef.id) : undefined}
                                        />
                                    </div>
                                    <ArrowRight class="h-3.5 w-3.5 shrink-0 text-base-content/50" />
                                    <div class="min-w-0 flex-1">
                                        <TaskRefCard
                                                task={toRef}
                                                {domains}
                                                onclick={onInspectTask ? () => onInspectTask(toRef.id) : undefined}
                                        />
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>

            {#if dependencyViewMode === 'explicit'}
                <TaskSearchableSelect
                        label="Add dependency"
                        tasks={eligibleDependencyTasks}
                        bind:value={addDependencySelection}
                        onSelect={handleAddDependencySelected}
                        {domains}
                        placeholder="Select prerequisite task..."
                        group="task-inspector-dependencies"
                />
            {/if}
        </div>
        {:else}
            <TaskEditorSessionsTab taskId={task.id} {tasks} {domains} />
        {/if}

    </div>
</div>

{#if showDeleteConfirm}
    <dialog class="modal modal-open">
        <div class="modal-box">
            <h3 class="text-lg font-bold">Delete task?</h3>
            <p class="py-4 text-base-content/70">
                This will permanently delete
                <span class="font-semibold">{localTask.title || 'Untitled task'}</span>.
            </p>
            <div class="modal-action">
                <button
                        type="button"
                        class="btn btn-ghost"
                        disabled={deleting}
                        onclick={() => (showDeleteConfirm = false)}
                >
                    Cancel
                </button>
                <button
                        type="button"
                        class="btn btn-error"
                        disabled={deleting}
                        onclick={confirmDelete}
                >
                    Delete
                </button>
            </div>
        </div>
        <form method="dialog" class="modal-backdrop">
            <button type="button" disabled={deleting} onclick={() => (showDeleteConfirm = false)}>
                close
            </button>
        </form>
    </dialog>
{/if}
