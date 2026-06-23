/** Entity tables the agent presents in typed `<factotum-view>` blocks. */
export const QUERYABLE_TABLES = [
    'task',
    'domain',
    'session',
    'aftermath',
    'task_status',
    'observation',
] as const

export type QueryableTableName = (typeof QUERYABLE_TABLES)[number]

/** Junction/edge tables — join freely in SQL; not used as `<factotum-view>` types. */
export const JOINABLE_TABLES = [
    'session_edge',
    'task_dependency',
    'task_status_edge',
] as const

export type JoinableTableName = (typeof JOINABLE_TABLES)[number]

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
    observations?: {
        applied: Array<{
            action: 'create' | 'update'
            record: {
                id: string
                content: string
                confidence: number
            }
        }>
        failed: Array<{
            input: ParsedObservation
            error: string
        }>
    }
}

export type ParsedObservation = {
    action: 'create' | 'update'
    id?: string
    content?: string
    confidence: number
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

export type LlmChatResponse = {
    content: string
    reasoningContent: string | null
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
