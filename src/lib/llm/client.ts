import { invoke } from '@tauri-apps/api/core'

import type { ChatMessage, LlmChatRequest, LlmChatResponse, LlmConfig, SqlRow } from './types'

function toRustConfig(config: LlmConfig) {
    return {
        provider: config.provider,
        base_url: config.baseUrl,
        model: config.model,
        api_key: config.apiKey ?? null,
        api_style: config.apiStyle,
    }
}

export async function llmChat(request: LlmChatRequest): Promise<LlmChatResponse> {
    const raw = await invoke<{ content: string; reasoning_content?: string | null }>('llm_chat', {
        request: {
            config: toRustConfig(request.config),
            messages: request.messages.map((message) => ({
                role: message.role,
                content: message.content,
            })),
            temperature: request.temperature ?? null,
            json_mode: request.jsonMode ?? null,
        },
    })

    return {
        content: raw.content ?? '',
        reasoningContent: raw.reasoning_content ?? null,
    }
}

export async function llmTestConnection(config: LlmConfig): Promise<string> {
    return invoke<string>('llm_test_connection', {
        config: toRustConfig(config),
    })
}

export async function llmListModels(config: LlmConfig): Promise<string[]> {
    return invoke<string[]>('llm_list_models', {
        config: toRustConfig(config),
    })
}

export async function executeReadonlySql(sql: string, maxRows = 100): Promise<SqlRow[]> {
    return invoke<SqlRow[]>('execute_readonly_sql', {
        sql,
        max_rows: maxRows,
    })
}

export function sqlRowsToRecords(rows: SqlRow[]): Record<string, unknown>[] {
    return rows.map((row) => {
        const record: Record<string, unknown> = {}
        row.columns.forEach((column, index) => {
            record[column] = row.rows[index] ?? null
        })
        return record
    })
}

export async function chatJson<T>(
    config: LlmConfig,
    messages: ChatMessage[],
    temperature = 0.3,
): Promise<T> {
    const raw = (
        await llmChat({
            config,
            messages,
            temperature,
            jsonMode: true,
        })
    ).content

    const trimmed = raw.trim()
    const jsonStart = trimmed.indexOf('{')
    const jsonEnd = trimmed.lastIndexOf('}')
    const payload =
        jsonStart >= 0 && jsonEnd > jsonStart
            ? trimmed.slice(jsonStart, jsonEnd + 1)
            : trimmed

    return JSON.parse(payload) as T
}
