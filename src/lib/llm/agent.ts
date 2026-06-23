import { llmChat, executeReadonlySql, sqlRowsToRecords } from './client'
import { isLlmConfigured, loadLlmConfig } from './config'
import {
    combineAssistantResponse,
    extractNarrative,
    extractProtocolParseableContent,
    formatAssistantStepDetail,
    formatToolResult,
    parseObservationBlocks,
    parseToolCalls,
    parseViewBlocks,
} from './agentProtocol'
import { applyObservationBlocks } from './observationPersistence'
import { resolveViews } from './views'
import { expandDynamicPromptTokens, expandPromptTokens, expandStaticPromptTokens } from './tokens'
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
const LEARN_AGENT_STEPS = 15

function isLearnPromptEntry(entry: { relativePath: string; absolutePath: string; name: string }): boolean {
    const path = `${entry.relativePath}/${entry.absolutePath}`.toLowerCase()
    return path.includes('learn.md') || entry.name.toLowerCase() === 'learn'
}

async function resolveMaxAgentSteps(promptId?: string | null): Promise<number> {
    const registry = await loadPromptRegistry()
    const entries = await resolveAllPromptEntries(registry)
    const selectedId = promptId ?? (await getSelectedPromptId()) ?? registry.lastSelectedId
    const entry = pickDefaultPromptEntry(entries, selectedId)
    return entry && isLearnPromptEntry(entry) ? LEARN_AGENT_STEPS : MAX_AGENT_STEPS
}

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

async function loadPromptTemplate(promptId?: string | null): Promise<string> {
    const registry = await loadPromptRegistry()
    const entries = await resolveAllPromptEntries(registry)
    const selectedId = promptId ?? (await getSelectedPromptId()) ?? registry.lastSelectedId
    const entry = pickDefaultPromptEntry(entries, selectedId)

    if (!entry) {
        throw new Error('No system prompt is configured. Add a prompt in LLM settings.')
    }

    return readPromptEntry(entry)
}

async function loadSystemPrompt(promptId?: string | null): Promise<string> {
    const template = await loadPromptTemplate(promptId)
    return expandPromptTokens(template)
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

    const promptTemplate = await loadPromptTemplate(options.promptId)
    const staticSystemPrompt = await expandStaticPromptTokens(promptTemplate)
    const maxSteps = await resolveMaxAgentSteps(options.promptId)
    const messages: ChatMessage[] = [
        { role: 'system', content: await expandDynamicPromptTokens(staticSystemPrompt) },
        { role: 'user', content: trimmedMessage },
    ]

    const steps: AgentStep[] = []
    let lastAssistantContent = ''
    let lastAssistantReasoning: string | null = null

    for (let step = 0; step < maxSteps; step += 1) {
        messages[0] = {
            role: 'system',
            content: await expandDynamicPromptTokens(staticSystemPrompt),
        }

        const assistantResponse = await llmChat({
            config,
            messages,
            temperature: 0.3,
        })

        const reasoning = assistantResponse.reasoningContent?.trim() || null
        const visibleContent = assistantResponse.content.trim()
        const assistantContent = visibleContent || reasoning || ''
        const reasoningForDisplay = visibleContent && reasoning ? reasoning : null

        lastAssistantContent = assistantContent
        lastAssistantReasoning = reasoningForDisplay

        steps.push({
            kind: 'llm',
            summary: `Model response (step ${step + 1})`,
            detail: formatAssistantStepDetail(assistantContent, reasoningForDisplay),
        })

        messages.push({ role: 'assistant', content: assistantContent })

        const toolCalls = parseToolCalls(extractProtocolParseableContent(assistantContent))
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

    const parseableContent = extractProtocolParseableContent(lastAssistantContent)
    const views = parseViewBlocks(parseableContent)
    const resolvedViews = await resolveViews(views)
    const narrative = extractNarrative(
        combineAssistantResponse(lastAssistantContent, lastAssistantReasoning),
    )
    const observationBlocks = parseObservationBlocks(parseableContent)
    const observationResult =
        observationBlocks.length > 0 ? await applyObservationBlocks(observationBlocks) : null

    return {
        narrative,
        views: resolvedViews,
        steps,
        usedLlm: true,
        observations: observationResult
            ? {
                  applied: observationResult.applied.map((entry) => ({
                      action: entry.action,
                      record: {
                          id: entry.record.id,
                          content: entry.record.content,
                          confidence: entry.record.confidence,
                      },
                  })),
                  failed: observationResult.failed,
              }
            : undefined,
    }
}

export async function suggestTasks(userRequest: string): Promise<AgentResult> {
    return runAgent({ userMessage: userRequest })
}

export { loadSystemPrompt }
