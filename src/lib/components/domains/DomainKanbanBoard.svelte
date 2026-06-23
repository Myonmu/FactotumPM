<script lang="ts">
    import { onMount } from 'svelte'

    import DomainColumn from '$lib/components/domains/DomainColumn.svelte'
    import DomainEditor from '$lib/components/domains/DomainEditor.svelte'
    import KanbanCard from '$lib/components/kanban/KanbanCard.svelte'
    import TaskEditor from '$lib/components/TaskEditor.svelte'
    import {
        createDomain,
        deleteDomain,
        domainToOption,
        loadDomains,
        moveTaskToDomain,
        UNASSIGNED_DOMAIN_ID,
        updateDomain,
        type DomainRecord,
    } from '$lib/db/domains'
    import {
        deleteTableRow,
        fetchTableRows,
        insertTableRow,
        loadDomainOptions,
        loadTaskDependencyEdges,
        loadTaskOptions,
        loadTaskRecord,
        recordToTask,
        saveTaskRecord,
        taskHasChildren,
        type TaskDependencyEdge,
        type TaskRecord,
        type TaskRef,
    } from '$lib/db/dataView'
    import {
        loadTaskStatusMachine,
        loadTaskStatusOptions,
        type TaskStatusEdgeRecord,
    } from '$lib/db/taskStatusMachine'
    import {
        groupTasksByDomain,
        sortDomainsForColumns,
    } from '$lib/domains/groupTasksByDomain'
    import { findDomainIdAtPoint } from '$lib/kanban/dragUtils'
    import { setKanbanDragging } from '$lib/kanban/kanbanDrag.svelte'
    import { closeInspector, openInspector, syncInspectedTask, updateInspectorProps } from '$lib/inspector.svelte'
    import {
        beginTaskInspectorSession,
        navigateToRelatedTask,
    } from '$lib/taskInspectorNav.svelte'
    import { getCurrentProjectId } from '$lib/projectState.svelte'

    let {
        onCreateDomain,
    }: {
        onCreateDomain?: () => void | Promise<void>
    } = $props()

    const currentProjectId = $derived(getCurrentProjectId())

    let domainRecords = $state<DomainRecord[]>([])
    let domainOptions = $state<ReturnType<typeof domainToOption>[]>([])
    let tasks = $state<TaskRecord[]>([])
    let taskOptions = $state<TaskRef[]>([])
    let statusOptions = $state<{ id: string; title: string; is_initial?: boolean }[]>([])
    let statusEdges = $state<TaskStatusEdgeRecord[]>([])
    let taskDependencies = $state<TaskDependencyEdge[]>([])
    let draggingTaskId = $state<string | null>(null)
    let hoverDomainId = $state<string | null>(null)
    let dragPosition = $state({ x: 0, y: 0 })
    let loading = $state(true)
    let error = $state<string | null>(null)
    let actionLoading = $state(false)

    const sortedDomains = $derived(sortDomainsForColumns(domainRecords))
    const tasksByDomain = $derived(groupTasksByDomain(domainRecords, tasks))
    const draggingTask = $derived(
        draggingTaskId ? tasks.find((task) => task.id === draggingTaskId) ?? null : null,
    )

    const taskCountsByDomain = $derived.by(() => {
        const counts = new Map<string, number>()
        counts.set(UNASSIGNED_DOMAIN_ID, 0)

        for (const entry of domainRecords) {
            counts.set(entry.id, 0)
        }

        for (const task of tasks) {
            const domainId =
                task.domain_id && counts.has(task.domain_id)
                    ? task.domain_id
                    : UNASSIGNED_DOMAIN_ID
            counts.set(domainId, (counts.get(domainId) ?? 0) + 1)
        }

        return counts
    })

    async function refreshTaskContext() {
        const projectId = currentProjectId
        const [loadedDomains, loadedTasks, loadedStatuses, machine, loadedDependencies] =
            await Promise.all([
                loadDomainOptions(projectId),
                loadTaskOptions(projectId),
                loadTaskStatusOptions(),
                loadTaskStatusMachine(projectId),
                loadTaskDependencyEdges(),
            ])

        domainOptions = loadedDomains
        taskOptions = loadedTasks
        statusOptions = loadedStatuses
        statusEdges = machine.edges
        taskDependencies = loadedDependencies
    }

    async function loadBoard() {
        loading = true
        error = null

        try {
            const projectId = currentProjectId
            const [loadedDomains, taskResult] = await Promise.all([
                loadDomains(projectId),
                fetchTableRows('task', projectId),
            ])

            domainRecords = loadedDomains
            tasks = taskResult.rows.map(recordToTask)
            await refreshTaskContext()
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to load domain board'
        } finally {
            loading = false
        }
    }

    export async function createAndInspectDomain() {
        actionLoading = true
        error = null

        try {
            const created = await createDomain()
            domainRecords = [...domainRecords, created]
            domainOptions = [...domainOptions, domainToOption(created)]
            await openDomainInspector(created)
            onCreateDomain?.()
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to create domain'
        } finally {
            actionLoading = false
        }
    }

    async function openDomainInspector(record: DomainRecord) {
        openInspector(
            DomainEditor,
            {
                domain: record,
                domains: domainOptions,
                saving: actionLoading,
                onSave: (patch) => handleDomainSave(record.id, patch),
                onDelete: () => handleDomainDelete(record.id),
                onCancel: closeInspector,
            },
            'Domain Inspector',
        )
    }

    async function handleDomainSave(
        domainId: string,
        patch: {
            name: string
            description: string | null
            color: number | null
            icon: string | null
            parent_domain_id: string | null
            project_id: string | null
        },
    ) {
        actionLoading = true
        error = null

        try {
            await updateDomain(domainId, patch)
            await loadBoard()
            const updated = domainRecords.find((entry) => entry.id === domainId)
            if (updated) {
                updateInspectorProps({ domain: updated, domains: domainOptions })
            }
        } finally {
            actionLoading = false
        }
    }

    async function handleDomainDelete(domainId: string) {
        actionLoading = true
        error = null

        try {
            await deleteDomain(domainId)
            closeInspector()
            await loadBoard()
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to delete domain'
            throw err
        } finally {
            actionLoading = false
        }
    }

    function handlePointerDragStart(event: PointerEvent, taskId: string) {
        setKanbanDragging(true)
        draggingTaskId = taskId
        dragPosition = { x: event.clientX, y: event.clientY }
        hoverDomainId = findDomainIdAtPoint(event.clientX, event.clientY)

        document.body.style.userSelect = 'none'
        document.body.style.cursor = 'grabbing'

        function handlePointerMove(moveEvent: PointerEvent) {
            dragPosition = { x: moveEvent.clientX, y: moveEvent.clientY }
            hoverDomainId = findDomainIdAtPoint(moveEvent.clientX, moveEvent.clientY)
        }

        async function handlePointerUp(upEvent: PointerEvent) {
            window.removeEventListener('pointermove', handlePointerMove)
            window.removeEventListener('pointerup', handlePointerUp)

            document.body.style.userSelect = ''
            document.body.style.cursor = ''
            setKanbanDragging(false)

            const targetDomainId = findDomainIdAtPoint(upEvent.clientX, upEvent.clientY)
            const sourceTaskId = draggingTaskId

            draggingTaskId = null
            hoverDomainId = null

            if (!sourceTaskId || !targetDomainId) return

            await handleDropTask(sourceTaskId, targetDomainId)
        }

        window.addEventListener('pointermove', handlePointerMove)
        window.addEventListener('pointerup', handlePointerUp)
    }

    async function handleDropTask(taskId: string, targetDomainId: string) {
        const task = tasks.find((entry) => entry.id === taskId)
        if (!task || actionLoading) return

        const nextDomainId =
            targetDomainId === UNASSIGNED_DOMAIN_ID ? null : targetDomainId

        if (task.domain_id === nextDomainId) return

        actionLoading = true
        error = null

        try {
            await moveTaskToDomain(taskId, nextDomainId)
            const updatedTask = { ...task, domain_id: nextDomainId }
            tasks = tasks.map((entry) => (entry.id === taskId ? updatedTask : entry))
            syncInspectedTask(updatedTask, { statusEdges })
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to move task'
        } finally {
            actionLoading = false
        }
    }

    async function inspectTaskById(taskId: string) {
        await refreshTaskContext()

        const taskRecord =
            tasks.find((entry) => entry.id === taskId) ?? (await loadTaskRecord(taskId))
        if (!taskRecord) return

        const hasChildren = await taskHasChildren(taskId)

        updateInspectorProps({
            task: taskRecord,
            domains: domainOptions,
            tasks: taskOptions,
            statuses: statusOptions,
            statusEdges,
            taskDependencies,
            hasChildren,
            onChildrenChange: () => handleChildrenChange(taskId),
            onDependenciesChange: () => handleDependenciesChange(taskId),
            onInspectTask: (childTaskId: string) => void navigateToRelatedTask(childTaskId),
        })
    }

    async function openTaskInspector(task: TaskRecord) {
        try {
            const hasChildren = await taskHasChildren(task.id)
            await refreshTaskContext()

            beginTaskInspectorSession(inspectTaskById)

            openInspector(
                TaskEditor,
                {
                    task,
                    domains: domainOptions,
                    tasks: taskOptions,
                    statuses: statusOptions,
                    statusEdges,
                    taskDependencies,
                    hasChildren,
                    onSave: handleTaskSave,
                    onDelete: handleTaskDelete,
                    onChildrenChange: () => handleChildrenChange(task.id),
                    onDependenciesChange: () => handleDependenciesChange(task.id),
                    onInspectTask: (childTaskId: string) => void navigateToRelatedTask(childTaskId),
                },
                'Task Inspector',
            )
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to open task inspector'
        }
    }

    async function handleTaskSave(updatedTask: TaskRecord) {
        await saveTaskRecord(updatedTask)
        tasks = tasks.map((task) => (task.id === updatedTask.id ? updatedTask : task))
        await refreshTaskContext()
        updateInspectorProps({ statusEdges })
    }

    async function handleChildrenChange(taskId: string) {
        const childCount = await taskHasChildren(taskId)
        await refreshTaskContext()
        updateInspectorProps({ hasChildren: childCount, tasks: taskOptions })
    }

    async function handleDependenciesChange(_taskId: string) {
        await refreshTaskContext()
        updateInspectorProps({ taskDependencies, tasks: taskOptions })
    }

    async function handleTaskDelete(taskId: string) {
        await deleteTableRow('task', taskId)
        tasks = tasks.filter((task) => task.id !== taskId)
        closeInspector()
        await refreshTaskContext()
    }

    async function handleAddTask(domainId: string) {
        if (actionLoading) return

        actionLoading = true
        error = null

        try {
            const newRow = await insertTableRow('task')
            const newTask = recordToTask(newRow)

            const targetDomainId = domainId === UNASSIGNED_DOMAIN_ID ? null : domainId
            if (newTask.domain_id !== targetDomainId) {
                await moveTaskToDomain(newTask.id, targetDomainId)
                newTask.domain_id = targetDomainId
            }

            tasks = [...tasks, newTask]
            await refreshTaskContext()
            await openTaskInspector(newTask)
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to add task'
        } finally {
            actionLoading = false
        }
    }

    let initialized = false

    onMount(() => {
        void loadBoard().then(() => { initialized = true })
    })

    $effect(() => {
        const _pid = currentProjectId
        if (initialized) void loadBoard()
    })
</script>

<div class="flex h-full min-h-0 flex-col">
    {#if loading}
        <div class="flex flex-1 items-center justify-center">
            <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>
    {:else if error && domainRecords.length === 0 && tasks.length === 0}
        <div class="alert alert-error max-w-2xl">
            <span>{error}</span>
        </div>
    {:else}
        {#if error}
            <div class="alert alert-error mb-4 max-w-2xl shrink-0">
                <span>{error}</span>
            </div>
        {/if}

        <div class="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-4">
            {#each sortedDomains as domain (domain.id)}
                {@const columnTasks = tasksByDomain.get(domain.id) ?? []}
                <DomainColumn
                        {domain}
                        domainOptions={domainOptions}
                        tasks={columnTasks}
                        totalTaskCount={taskCountsByDomain.get(domain.id) ?? 0}
                        draggingTaskId={draggingTaskId}
                        dropHighlight={hoverDomainId === domain.id && draggingTaskId ? 'allowed' : null}
                        onHeaderClick={() => void openDomainInspector(domain)}
                        onPointerDragStart={handlePointerDragStart}
                        onCardClick={(task) => void openTaskInspector(task)}
                        onAddTask={() => void handleAddTask(domain.id)}
                />
            {/each}

            <DomainColumn
                    domain={null}
                    domainOptions={domainOptions}
                    tasks={tasksByDomain.get(UNASSIGNED_DOMAIN_ID) ?? []}
                    totalTaskCount={taskCountsByDomain.get(UNASSIGNED_DOMAIN_ID) ?? 0}
                    draggingTaskId={draggingTaskId}
                    dropHighlight={hoverDomainId === UNASSIGNED_DOMAIN_ID && draggingTaskId ? 'allowed' : null}
                    onPointerDragStart={handlePointerDragStart}
                    onCardClick={(task) => void openTaskInspector(task)}
                    onAddTask={() => void handleAddTask(UNASSIGNED_DOMAIN_ID)}
            />
        </div>
    {/if}
</div>

{#if draggingTask}
    <div
            class="pointer-events-none fixed z-[100] w-64 -translate-x-1/2 -translate-y-1/2 opacity-90"
            style:left="{dragPosition.x}px"
            style:top="{dragPosition.y}px"
    >
        <KanbanCard task={draggingTask} domains={domainOptions} dragging={true} />
    </div>
{/if}
