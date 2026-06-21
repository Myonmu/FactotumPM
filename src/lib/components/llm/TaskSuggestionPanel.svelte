<script lang="ts">
    import { onMount } from 'svelte'
    import { FileText, Settings2, Sparkles } from 'lucide-svelte'

    import AgentResultView from '$lib/components/llm/AgentResultView.svelte'
    import LlmSettingsPanel from '$lib/components/llm/LlmSettingsPanel.svelte'
    import PromptManagePanel from '$lib/components/llm/PromptManagePanel.svelte'
    import {
        isLlmConfigured,
        loadLlmConfig,
        loadPromptRegistry,
        resolveAllPromptEntries,
        getSelectedPromptId,
        setSelectedPromptId,
        pickDefaultPromptEntry,
        runAgent,
        type ResolvedPromptEntry,
    } from '$lib/llm'
    import {
        getAgentError,
        getAgentLoading,
        getAgentResult,
        getAgentSelectedPromptId,
        getAgentUserRequest,
        setAgentError,
        setAgentLoading,
        setAgentResult,
        setAgentSelectedPromptId,
        setAgentUserRequest,
    } from '$lib/llm/agentState.svelte'

    let llmReady = $state(false)
    let showSettings = $state(false)
    let showPrompts = $state(false)
    let promptEntries = $state<ResolvedPromptEntry[]>([])

    const userRequest = $derived(getAgentUserRequest())
    const loading = $derived(getAgentLoading())
    const error = $derived(getAgentError())
    const result = $derived(getAgentResult())
    const selectedPromptId = $derived(getAgentSelectedPromptId())

    async function refreshPromptList() {
        const registry = await loadPromptRegistry()
        promptEntries = await resolveAllPromptEntries(registry)
        const selectedId =
            getAgentSelectedPromptId() ||
            (await getSelectedPromptId()) ||
            registry.lastSelectedId ||
            pickDefaultPromptEntry(promptEntries, null)?.id ||
            ''

        if (selectedId) {
            setAgentSelectedPromptId(selectedId)
        }
    }

    onMount(async () => {
        const config = await loadLlmConfig()
        llmReady = isLlmConfigured(config)
        await refreshPromptList()
    })

    async function refreshLlmStatus() {
        const config = await loadLlmConfig()
        llmReady = isLlmConfigured(config)
    }

    async function handlePromptChange(event: Event) {
        const value = (event.currentTarget as HTMLSelectElement).value
        setAgentSelectedPromptId(value)
        await setSelectedPromptId(value)
    }

    async function handleRun() {
        if (loading || !userRequest.trim()) return

        setAgentLoading(true)
        setAgentError(null)
        setAgentResult(null)

        try {
            const agentResult = await runAgent({
                userMessage: userRequest,
                promptId: selectedPromptId || null,
            })
            setAgentResult(agentResult)
        } catch (err) {
            setAgentError(err instanceof Error ? err.message : 'Agent run failed')
        } finally {
            setAgentLoading(false)
        }
    }
</script>

<section class="rounded-box border border-base-300 bg-base-100 p-5 shadow-sm">
    <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
            <div class="flex items-center gap-2">
                <Sparkles class="h-5 w-5 text-primary" />
                <h2 class="text-xl font-semibold">Factotum agent</h2>
            </div>
            <p class="mt-1 text-sm text-base-content/60">
                Describe what you want. The agent queries your database in multiple steps, then
                presents typed results.
            </p>
        </div>

        <div class="flex flex-wrap gap-2">
            <button
                    type="button"
                    class="btn btn-ghost btn-sm gap-2"
                    onclick={() => {
                        showPrompts = true
                    }}
            >
                <FileText class="h-4 w-4" />
                Prompts
            </button>
            <button
                    type="button"
                    class="btn btn-ghost btn-sm gap-2"
                    onclick={() => {
                        showSettings = true
                    }}
            >
                <Settings2 class="h-4 w-4" />
                LLM settings
            </button>
        </div>
    </div>

    {#if !llmReady}
        <div class="alert alert-info mb-4 text-sm">
            <span>Configure and enable an LLM in settings before running the agent.</span>
        </div>
    {/if}

    <label class="form-control w-full">
        <span class="label-text mb-2 font-medium">System prompt</span>
        <select
                class="select select-bordered w-full"
                value={selectedPromptId}
                onchange={(event) => void handlePromptChange(event)}
                disabled={loading || promptEntries.length === 0}
        >
            {#each promptEntries as entry (entry.id)}
                <option value={entry.id} disabled={!entry.isValid}>
                    {entry.name}{entry.isDefault ? ' (default)' : ''}{!entry.isValid ? ' — missing' : ''}
                </option>
            {/each}
        </select>
    </label>

    <label class="form-control mt-4 w-full">
        <span class="label-text mb-2 font-medium">Your request</span>
        <textarea
                class="textarea textarea-bordered min-h-24 w-full"
                placeholder='Example: "I want something different, but still artistic."'
                value={userRequest}
                oninput={(event) =>
                    setAgentUserRequest((event.currentTarget as HTMLTextAreaElement).value)}
                disabled={loading}
        ></textarea>
    </label>

    <div class="mt-4 flex flex-wrap items-center gap-3">
        <button
                type="button"
                class="btn btn-primary"
                disabled={loading || !userRequest.trim() || !llmReady}
                onclick={() => void handleRun()}
        >
            {#if loading}
                <span class="loading loading-spinner loading-sm"></span>
                Agent working...
            {:else}
                Run agent
            {/if}
        </button>
    </div>

    {#if error}
        <div class="alert alert-error mt-4 text-sm">
            <span>{error}</span>
        </div>
    {/if}

    {#if result}
        <div class="mt-6">
            <AgentResultView {result} />
        </div>
    {/if}
</section>

{#if showSettings}
    <LlmSettingsPanel
            onClose={() => {
                showSettings = false
            }}
            onSaved={() => void refreshLlmStatus()}
    />
{/if}

{#if showPrompts}
    <PromptManagePanel
            onClose={() => {
                showPrompts = false
            }}
            onChanged={() => void refreshPromptList()}
    />
{/if}
