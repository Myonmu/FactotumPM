<script lang="ts">
    import { onMount } from 'svelte'

    import KanbanCard from '$lib/components/kanban/KanbanCard.svelte'
    import TrophyCard from '$lib/components/trophy/TrophyCard.svelte'
    import type { DomainOption, TaskRecord, TaskRef } from '$lib/db/dataView'
    import { fetchTableRows, loadTaskRecord, recordToTask } from '$lib/db/dataView'
    import { loadTaskStatusMachine } from '$lib/db/taskStatusMachine'
    import type { TrophyView } from '$lib/trophy/computeTrophies'
    import { computeTrophyViewsByTaskId } from '$lib/trophy/computeTrophies'
    import { loadSessionTimeIndex } from '$lib/trophy/trophyTime'

    let {
        task,
        domains = [],
    }: {
        task: TaskRef
        domains?: DomainOption[]
    } = $props()

    let taskRecord = $state<TaskRecord | null>(null)
    let trophyView = $state<TrophyView | null>(null)
    let loading = $state(true)

    onMount(() => {
        void (async () => {
            const record = await loadTaskRecord(task.id)
            taskRecord = record
            if (!record?.is_trophy) {
                loading = false
                return
            }

            const taskResult = await fetchTableRows('task', record.project_id)
            const tasks = taskResult.rows.map((row) => recordToTask(row))
            const { statuses } = await loadTaskStatusMachine(record.project_id)
            const terminalStatusIds = new Set(
                statuses.filter((status) => status.is_terminal).map((status) => status.id),
            )
            const sessionTime = await loadSessionTimeIndex()
            const views = computeTrophyViewsByTaskId(tasks, terminalStatusIds, sessionTime)
            trophyView = views.get(record.id) ?? null
            loading = false
        })()
    })
</script>

<div class="task-ref-card-preview w-72 max-w-full shadow-lg">
    {#if loading}
        <div class="flex min-h-24 items-center justify-center rounded-box border border-base-300 bg-base-100">
            <span class="loading loading-spinner loading-sm text-primary"></span>
        </div>
    {:else if taskRecord && taskRecord.is_trophy && trophyView}
        <TrophyCard view={trophyView} {domains} preview />
    {:else if taskRecord}
        <KanbanCard task={taskRecord} {domains} preview />
    {/if}
</div>
