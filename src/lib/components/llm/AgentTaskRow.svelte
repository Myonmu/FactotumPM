<script lang="ts">
    import TaskRefCard from '$lib/components/TaskRefCard.svelte'
    import { isTaskActionable, type DomainOption, type TaskRef } from '$lib/db/dataView'
    import { createAndStartSessionForTask } from '$lib/db/sessions'
    import { showErrorToast, showSessionStartedToast } from '$lib/notifications.svelte'

    let {
        task,
        domains = [],
    }: {
        task: TaskRef
        domains?: DomainOption[]
    } = $props()

    let starting = $state(false)
    let actionable = $state<boolean | null>(null)

    $effect(() => {
        const taskId = task.id
        let cancelled = false
        actionable = null

        void isTaskActionable(taskId).then((value) => {
            if (!cancelled) {
                actionable = value
            }
        })

        return () => {
            cancelled = true
        }
    })

    async function handleStartSession() {
        if (starting || actionable !== true) return

        starting = true
        try {
            await createAndStartSessionForTask(task.id)
            showSessionStartedToast(task.title?.trim() || 'Untitled task')
        } catch (err) {
            showErrorToast(err instanceof Error ? err.message : 'Failed to start session')
        } finally {
            starting = false
        }
    }
</script>

<div class="agent-task-row flex items-start gap-3">
    <div class="min-w-0 flex-1">
        <TaskRefCard {task} {domains} class="w-full" />
    </div>
    {#if actionable === true}
        <button
                type="button"
                class="btn btn-primary btn-sm shrink-0"
                disabled={starting}
                onclick={() => void handleStartSession()}
        >
            {#if starting}
                <span class="loading loading-spinner loading-xs"></span>
            {/if}
            Start session
        </button>
    {/if}
</div>
