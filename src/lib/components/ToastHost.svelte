<script lang="ts">
    import { getToasts } from '$lib/notifications.svelte'

    const toasts = $derived(getToasts())
</script>

{#if toasts.length > 0}
    <div class="toast toast-top toast-end z-50">
        {#each toasts as toast (toast.id)}
            <div
                    class="alert text-sm shadow-lg"
                    class:alert-success={toast.kind === 'session_started'}
                    class:alert-error={toast.kind === 'error'}
            >
                {#if toast.kind === 'session_started'}
                    <span>
                        Session <strong>{toast.taskTitle ?? 'Untitled task'}</strong> started
                    </span>
                {:else}
                    <span>{toast.message ?? 'Something went wrong'}</span>
                {/if}
            </div>
        {/each}
    </div>
{/if}
