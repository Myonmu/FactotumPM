/** Entity tables the LLM may query and present (excludes edge/junction/internal tables). */
export const QUERYABLE_TABLES = [
    'task',
    'domain',
    'session',
    'aftermath',
    'task_status',
] as const

export type QueryableTableName = (typeof QUERYABLE_TABLES)[number]

export const VIEW_TYPES = [
    'table',
    'task',
    'session',
    'domain',
    'aftermath',
    'task_status',
] as const

export type FactotumViewType = (typeof VIEW_TYPES)[number]

export type AgentToolCall = {
    action: 'query'
    sql: string
}

export type AgentToolResult = {
    action: 'query'
    columns: string[]
    rows: unknown[][]
    row_count: number
    error: string | null
    warning?: string | null
}

export type ParsedFactotumView = {
    type: FactotumViewType
    title: string | null
    sql?: string
    inlineColumns?: string[]
    inlineRecords?: Record<string, unknown>[]
    inlineWarning?: string
    parseError?: string
    rawBody?: string
}

export type ResolvedFactotumView = {
    type: FactotumViewType
    title: string | null
    columns: string[]
    records: Record<string, unknown>[]
    entityIds: string[]
    sql: string | null
    warning: string | null
    error: string | null
}

export type AgentStep = {
    kind: 'llm' | 'tool'
    summary: string
    detail?: string
}

export type AgentResult = {
    narrative: string
    views: ResolvedFactotumView[]
    steps: AgentStep[]
    usedLlm: boolean
}

/** @deprecated Use AgentResult */
export type TaskRecommendation = {
    taskId: string
    title: string
    domainName: string | null
    reason: string
    complexity: number | null
    effort: number | null
}

/** @deprecated Use AgentResult */
export type TaskSuggestionResult = {
    analysis: string
    recommendations: TaskRecommendation[]
    queriesRun: string[]
    usedLlm: boolean
}

export type LlmProvider = 'ollama' | 'lmstudio' | 'openai' | 'custom'

export type LlmApiStyle = 'openai' | 'ollama'

export type LlmConfig = {
    provider: LlmProvider
    baseUrl: string
    model: string
    apiKey?: string | null
    apiStyle: LlmApiStyle
    enabled: boolean
}

export type ChatMessage = {
    role: 'system' | 'user' | 'assistant'
    content: string
}

export type LlmChatRequest = {
    config: LlmConfig
    messages: ChatMessage[]
    temperature?: number
    jsonMode?: boolean
}

export type SqlRow = {
    columns: string[]
    rows: (string | number | boolean | null)[]
}

export type PromptEntry = {
    id: string
    name: string
    relativePath: string
    absolutePath: string
    isDefault?: boolean
    description?: string
}

export type PromptRegistry = {
    entries: PromptEntry[]
    lastSelectedId: string | null
}

export type ResolvedPromptEntry = PromptEntry & {
    resolvedPath: string
    isValid: boolean
}
