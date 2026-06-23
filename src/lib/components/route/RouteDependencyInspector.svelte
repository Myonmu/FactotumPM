<script lang="ts">
    import { Trash2 } from 'lucide-svelte'

    let {
        fromTaskTitle,
        toTaskTitle,
        onDelete,
    }: {
        fromTaskTitle: string
        toTaskTitle: string
        onDelete?: () => void | Promise<void>
    } = $props()

    let deleting = $state(false)

    async function handleDelete() {
        if (!onDelete || deleting) return

        deleting = true
        try {
            await onDelete()
        } finally {
            deleting = false
        }
    }
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4">
    <p class="text-sm text-base-content/70">
        <span class="font-medium">{fromTaskTitle}</span>
        depends on
        <span class="font-medium">{toTaskTitle}</span>.
    </p>

    <p class="text-xs text-base-content/60">
        The source task cannot start until the prerequisite task is complete.
    </p>

    <button
            type="button"
            class="btn btn-error btn-outline btn-sm gap-2 self-start"
            disabled={deleting}
            onclick={() => void handleDelete()}
    >
        {#if deleting}
            <span class="loading loading-spinner loading-xs"></span>
        {:else}
            <Trash2 class="h-4 w-4" />
        {/if}
        Delete dependency
    </button>
</div>
