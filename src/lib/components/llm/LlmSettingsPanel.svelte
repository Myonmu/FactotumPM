<script lang="ts">
    import { onMount } from 'svelte'
    import { RefreshCw, X } from 'lucide-svelte'

    import {
        apiStyleForProvider,
        createDefaultLlmConfig,
        DEFAULT_LLM_CONFIGS,
        loadLlmConfig,
        llmListModels,
        llmTestConnection,
        providerLabel,
        saveLlmConfig,
        type LlmConfig,
        type LlmProvider,
    } from '$lib/llm'

    const CUSTOM_MODEL_VALUE = '__custom__'

    const {
        onClose,
        onSaved,
    }: {
        onClose?: () => void
        onSaved?: () => void
    } = $props()

    let config = $state<LlmConfig>(createDefaultLlmConfig())
    let saving = $state(false)
    let testing = $state(false)
    let loadingModels = $state(false)
    let message = $state<string | null>(null)
    let error = $state<string | null>(null)
    let modelsError = $state<string | null>(null)
    let modelOptions = $state<string[]>([])
    let modelSelectValue = $state('')

    const showCustomModelInput = $derived(
        modelSelectValue === CUSTOM_MODEL_VALUE ||
            (modelOptions.length === 0 && !!config.model.trim()),
    )

    function syncModelSelect() {
        if (modelOptions.includes(config.model)) {
            modelSelectValue = config.model
            return
        }

        if (config.model.trim()) {
            modelSelectValue = CUSTOM_MODEL_VALUE
            return
        }

        modelSelectValue = modelOptions[0] ?? CUSTOM_MODEL_VALUE
        if (modelOptions[0]) {
            config.model = modelOptions[0]
        }
    }

    async function refreshModels() {
        if (!config.baseUrl.trim()) {
            modelsError = 'Enter a base URL first.'
            modelOptions = []
            return
        }

        loadingModels = true
        modelsError = null

        try {
            modelOptions = await llmListModels(config)
            syncModelSelect()
        } catch (err) {
            modelOptions = []
            modelsError =
                err instanceof Error ? err.message : 'Failed to load models from server'
            modelSelectValue = CUSTOM_MODEL_VALUE
        } finally {
            loadingModels = false
        }
    }

    onMount(async () => {
        config = await loadLlmConfig()
        syncModelSelect()
        void refreshModels()
    })

    function applyProviderDefaults(provider: LlmProvider) {
        config = {
            ...config,
            ...DEFAULT_LLM_CONFIGS[provider],
            provider,
            enabled: config.enabled,
            apiKey: config.apiKey ?? DEFAULT_LLM_CONFIGS[provider].apiKey,
        }
        void refreshModels()
    }

    function handleModelSelect(event: Event) {
        const value = (event.currentTarget as HTMLSelectElement).value
        modelSelectValue = value

        if (value === CUSTOM_MODEL_VALUE) return
        config.model = value
    }

    async function handleSave() {
        saving = true
        error = null
        message = null

        try {
            await saveLlmConfig(config)
            message = 'Settings saved.'
            onSaved?.()
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to save settings'
        } finally {
            saving = false
        }
    }

    async function handleTest() {
        testing = true
        error = null
        message = null

        try {
            const reply = await llmTestConnection(config)
            message = `Connection OK. Model replied: "${reply}"`
        } catch (err) {
            error = err instanceof Error ? err.message : 'Connection test failed'
        } finally {
            testing = false
        }
    }
</script>

<div class="modal modal-open">
    <div class="modal-box max-w-2xl">
        <div class="mb-4 flex items-start justify-between gap-3">
            <div>
                <h3 class="text-lg font-bold">LLM bridge settings</h3>
                <p class="mt-1 text-sm text-base-content/60">
                    Connect a local model (Ollama, LM Studio) or a cloud provider with an
                    OpenAI-compatible API.
                </p>
            </div>
            <button type="button" class="btn btn-ghost btn-sm btn-square" onclick={() => onClose?.()}>
                <X class="h-4 w-4" />
            </button>
        </div>

        <label class="label cursor-pointer justify-start gap-3">
            <input type="checkbox" class="toggle toggle-primary" bind:checked={config.enabled} />
            <span class="label-text">Enable LLM suggestions</span>
        </label>

        <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <label class="form-control">
                <span class="label-text">Provider</span>
                <select
                        class="select select-bordered"
                        value={config.provider}
                        onchange={(event) => {
                            const provider = (event.currentTarget as HTMLSelectElement)
                                .value as LlmProvider
                            applyProviderDefaults(provider)
                        }}
                >
                    {#each Object.keys(DEFAULT_LLM_CONFIGS) as provider (provider)}
                        <option value={provider}>{providerLabel(provider as LlmProvider)}</option>
                    {/each}
                </select>
            </label>

            <label class="form-control">
                <span class="label-text">API style</span>
                <select
                        class="select select-bordered"
                        bind:value={config.apiStyle}
                        onchange={() => void refreshModels()}
                >
                    <option value="openai">OpenAI-compatible (/v1/chat/completions)</option>
                    <option value="ollama">Ollama native (/api/chat)</option>
                </select>
                <span class="label-text-alt mt-1">
                    Default for {providerLabel(config.provider)}:
                    {apiStyleForProvider(config.provider)}
                </span>
            </label>
        </div>

        <label class="form-control mt-4">
            <span class="label-text">Base URL</span>
            <input
                    class="input input-bordered"
                    bind:value={config.baseUrl}
                    onchange={() => void refreshModels()}
            />
        </label>

        <div class="form-control mt-4">
            <div class="label">
                <span class="label-text">Model</span>
                <button
                        type="button"
                        class="btn btn-ghost btn-xs gap-1"
                        disabled={loadingModels}
                        onclick={() => void refreshModels()}
                >
                    {#if loadingModels}
                        <span class="loading loading-spinner loading-xs"></span>
                    {:else}
                        <RefreshCw class="h-3.5 w-3.5" />
                    {/if}
                    Refresh
                </button>
            </div>

            <select
                    class="select select-bordered w-full"
                    value={modelSelectValue}
                    onchange={handleModelSelect}
                    disabled={loadingModels || modelOptions.length === 0}
            >
                {#if modelOptions.length === 0}
                    <option value={CUSTOM_MODEL_VALUE}>Enter model manually</option>
                {:else}
                    {#each modelOptions as modelId (modelId)}
                        <option value={modelId}>{modelId}</option>
                    {/each}
                    <option value={CUSTOM_MODEL_VALUE}>Other (manual entry)</option>
                {/if}
            </select>

            {#if showCustomModelInput}
                <input
                        class="input input-bordered mt-2 w-full"
                        bind:value={config.model}
                        placeholder="e.g. qwen/qwen3.6-27b"
                />
            {/if}

            {#if modelsError}
                <span class="label-text-alt mt-1 text-warning">{modelsError}</span>
            {:else if modelOptions.length > 0}
                <span class="label-text-alt mt-1">
                    {modelOptions.length} model(s) from server
                </span>
            {/if}
        </div>

        <label class="form-control mt-4">
            <span class="label-text">API key (optional)</span>
            <input
                    class="input input-bordered"
                    type="password"
                    bind:value={config.apiKey}
                    placeholder="Required for cloud providers"
            />
        </label>

        {#if message}
            <div class="alert alert-success mt-4 text-sm">
                <span>{message}</span>
            </div>
        {/if}

        {#if error}
            <div class="alert alert-error mt-4 text-sm">
                <span>{error}</span>
            </div>
        {/if}

        <div class="modal-action">
            <button type="button" class="btn btn-ghost" onclick={() => onClose?.()}>Close</button>
            <button
                    type="button"
                    class="btn btn-outline"
                    disabled={testing}
                    onclick={() => void handleTest()}
            >
                {#if testing}
                    <span class="loading loading-spinner loading-sm"></span>
                    Testing (large models may take 1–2 min)...
                {:else}
                    Test connection
                {/if}
            </button>
            <button
                    type="button"
                    class="btn btn-primary"
                    disabled={saving}
                    onclick={() => void handleSave()}
            >
                Save
            </button>
        </div>
    </div>
    <button type="button" class="modal-backdrop" aria-label="Close" onclick={() => onClose?.()}></button>
</div>
