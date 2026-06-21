import { getPrefJson, savePrefJson } from '$lib/prefStore'

import type { LlmApiStyle, LlmConfig, LlmProvider } from './types'

const LLM_CONFIG_KEY = 'llm.config'

export const DEFAULT_LLM_CONFIGS: Record<LlmProvider, Omit<LlmConfig, 'enabled'>> = {
    ollama: {
        provider: 'ollama',
        baseUrl: 'http://127.0.0.1:11434',
        model: 'llama3.2',
        apiKey: null,
        apiStyle: 'ollama',
    },
    lmstudio: {
        provider: 'lmstudio',
        baseUrl: 'http://127.0.0.1:1234',
        model: 'qwen/qwen3.6-27b',
        apiKey: null,
        apiStyle: 'openai',
    },
    openai: {
        provider: 'openai',
        baseUrl: 'https://api.openai.com',
        model: 'gpt-4o-mini',
        apiKey: null,
        apiStyle: 'openai',
    },
    custom: {
        provider: 'custom',
        baseUrl: 'http://127.0.0.1:11434',
        model: 'local-model',
        apiKey: null,
        apiStyle: 'openai',
    },
}

export function createDefaultLlmConfig(provider: LlmProvider = 'ollama'): LlmConfig {
    return {
        ...DEFAULT_LLM_CONFIGS[provider],
        enabled: false,
    }
}

export async function loadLlmConfig(): Promise<LlmConfig> {
    const saved = await getPrefJson<LlmConfig>(LLM_CONFIG_KEY)
    if (!saved) {
        return createDefaultLlmConfig()
    }

    return {
        ...createDefaultLlmConfig(saved.provider ?? 'ollama'),
        ...saved,
    }
}

export async function saveLlmConfig(config: LlmConfig): Promise<void> {
    await savePrefJson(LLM_CONFIG_KEY, config)
}

export function providerLabel(provider: LlmProvider): string {
    switch (provider) {
        case 'ollama':
            return 'Ollama'
        case 'lmstudio':
            return 'LM Studio'
        case 'openai':
            return 'OpenAI'
        case 'custom':
            return 'Custom (OpenAI-compatible)'
    }
}

export function apiStyleForProvider(provider: LlmProvider): LlmApiStyle {
    return DEFAULT_LLM_CONFIGS[provider].apiStyle
}

export function isLlmConfigured(config: LlmConfig): boolean {
    return config.enabled && config.baseUrl.trim().length > 0 && config.model.trim().length > 0
}
