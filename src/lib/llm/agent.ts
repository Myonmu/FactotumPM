import { llmChat, executeReadonlySql, sqlRowsToRecords } from './client'
import { isLlmConfigured, loadLlmConfig } from './config'
import {
    extractNarrative,
    formatToolResult,
    parseToolCalls,
    parseViewBlocks,
} from './agentProtocol'
import { resolveViews } from './views'
import { expandPromptTokens } from './tokens'
import {
    loadPromptRegistry,
    pickDefaultPromptEntry,
    readPromptEntry,
    resolveAllPromptEntries,
    getSelectedPromptId,
} from './promptRegistry'
import type {
    AgentResult,
    AgentStep,
    AgentToolResult,
    ChatMessage,
    LlmConfig,
} from './types'

import { selectIncludesPrimaryKey } from './viewIdEnforcement'

const MAX_AGENT_STEPS = 10

async function executeToolQuery(sql: string): Promise<AgentToolResult> {
    try {
        const rows = await executeReadonlySql(sql, 50)
        const records = sqlRowsToRecords(rows)
        const columns = rows[0]?.columns ?? []

        let warning: string | null = null
        if (records.length > 0 && !selectIncludesPrimaryKey(sql)) {
            warning =
                'Query results may not render in views: include SELECT id (or SELECT *) so rows can be hydrated by primary key.'
        }

        return {
            action: 'query',
            columns,
            rows: records.map((record) => columns.map((column) => record[column] ?? null)),
            row_count: records.length,
            error: null,
            warning,
        }
    } catch (err) {
        return {
            action: 'query',
            columns: [],
            rows: [],
            row_count: 0,
            error: err instanceof Error ? err.message : 'Query failed',
        }
    }
}

async function loadSystemPrompt(promptId?: string | null): Promise<string> {
    const registry = await loadPromptRegistry()
    const entries = await resolveAllPromptEntries(registry)
    const selectedId = promptId ?? (await getSelectedPromptId()) ?? registry.lastSelectedId
    const entry = pickDefaultPromptEntry(entries, selectedId)

    if (!entry) {
        throw new Error('No system prompt is configured. Add a prompt in LLM settings.')
    }

    const raw = await readPromptEntry(entry)
    return expandPromptTokens(raw)
}

export async function runAgent(options: {
    userMessage: string
    promptId?: string | null
    config?: LlmConfig
}): Promise<AgentResult> {
    const trimmedMessage = options.userMessage.trim()
    if (!trimmedMessage) {
        throw new Error('Enter a request for the agent.')
    }

    const config = options.config ?? (await loadLlmConfig())
    if (!isLlmConfigured(config)) {
        throw new Error('LLM is not configured. Enable it in LLM settings.')
    }

    const systemPrompt = await loadSystemPrompt(options.promptId)
    const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: trimmedMessage },
    ]

    const steps: AgentStep[] = []
    let lastAssistantContent = ''

    for (let step = 0; step < MAX_AGENT_STEPS; step += 1) {
        const assistantContent = await llmChat({
            config,
            messages,
            temperature: 0.3,
        })

        lastAssistantContent = assistantContent
        steps.push({
            kind: 'llm',
            summary: `Model response (step ${step + 1})`,
            detail: assistantContent,
        })

        messages.push({ role: 'assistant', content: assistantContent })

        const toolCalls = parseToolCalls(assistantContent)
        if (toolCalls.length === 0) {
            break
        }

        const toolResults: string[] = []
        for (const call of toolCalls) {
            const result = await executeToolQuery(call.sql)
            const formatted = formatToolResult(result)
            toolResults.push(formatted)
            steps.push({
                kind: 'tool',
                summary: result.error
                    ? `Query failed: ${result.error}`
                    : `Query returned ${result.row_count} row(s)`,
                detail: [
                    'SQL:',
                    call.sql,
                    '',
                    'Result:',
                    formatted,
                ].join('\n'),
            })
        }

        messages.push({
            role: 'user',
            content: toolResults.join('\n\n'),
        })
    }

    const views = parseViewBlocks(lastAssistantContent)
    const resolvedViews = await resolveViews(views)
    const narrative = extractNarrative(lastAssistantContent)

    return {
        narrative,
        views: resolvedViews,
        steps,
        usedLlm: true,
    }
}

export async function suggestTasks(userRequest: string): Promise<AgentResult> {
    return runAgent({ userMessage: userRequest })
}

export { loadSystemPrompt }
