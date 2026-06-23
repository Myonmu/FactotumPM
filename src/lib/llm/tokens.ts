import {
    buildRecommendationContext,
    formatContextForPrompt,
} from './contextBuilder'
import { formatObservationsForPrompt, loadObservations } from '$lib/db/observations'
import {
    AGENT_JOINABLE_TABLES,
    formatColumnSpec,
    formatJoinableTablesForAgent,
    formatSqlTablesForAgent,
    formatTableColumnsForAgent,
} from './columnTypes'
import { FACTOTUM_SCHEMA_CONTEXT } from './schemaContext'
import { JOINABLE_TABLES, QUERYABLE_TABLES, type JoinableTableName, type QueryableTableName } from './types'

export const TOKEN_REFERENCE = `
Available special tokens (replaced before the prompt is sent to the LLM):

- [schema] — full SQLite schema and design notes for FactotumPM
- [context] — live summary: current project scope, domains, recent session activity, open task count
- [domains] — list of domains with ids, names, descriptions
- [observations] — saved behavioral patterns (id, confidence, plain text) from past Learn runs
- [queryable_tables] — entity tables + join tables (with SQL join guidance)
- [joinable_tables] — junction tables only (session_edge, task_dependency, task_status_edge)
- [tokens] — this reference list
- [table:NAME] — typed columns for one table, e.g. [table:task], [table:session_edge]

Type legend for [table:NAME] and [schema]: uuid, integer, real, boolean (0/1 in SQL), datetime (ISO TEXT), enum (integer code), text.
Boolean columns: compare with 0/1 in SQL (e.g. WHERE is_terminal = 1), not strings.
Metric *_can_estimate columns: null=unset, 0=unknown, 1=has estimate (INTEGER, not boolean).

Entity tables map to <factotum-view type="...">. Join tables are for SQL JOINs only — use them freely in tool queries.
`.trim()

const TABLE_COLUMNS: Record<QueryableTableName, string> = {
    task: formatTableColumnsForAgent('task'),
    domain: formatTableColumnsForAgent('domain'),
    session: formatTableColumnsForAgent('session'),
    aftermath: formatTableColumnsForAgent('aftermath'),
    task_status: formatTableColumnsForAgent('task_status'),
    observation: formatTableColumnsForAgent('observation'),
}

const TOKEN_PATTERN = /\[([a-z_]+(?::[a-z_]+)?)\]/gi

const DYNAMIC_TOKENS = new Set(['context', 'domains', 'observations'])

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function replaceToken(template: string, token: string, value: string): string {
    const pattern = new RegExp(`\\[${escapeRegExp(token)}\\]`, 'gi')
    return template.replace(pattern, () => value)
}

function isDynamicPromptToken(token: string): boolean {
    return DYNAMIC_TOKENS.has(token.toLowerCase())
}

function isQueryableTable(name: string): name is QueryableTableName {
    return (QUERYABLE_TABLES as readonly string[]).includes(name)
}

function isJoinableTable(name: string): name is JoinableTableName {
    return (JOINABLE_TABLES as readonly string[]).includes(name)
}

async function resolveToken(token: string): Promise<string> {
    const normalized = token.toLowerCase()

    switch (normalized) {
        case 'schema':
            return FACTOTUM_SCHEMA_CONTEXT
        case 'context': {
            const context = await buildRecommendationContext()
            return formatContextForPrompt(context)
        }
        case 'domains': {
            const context = await buildRecommendationContext()
            if (context.domains.length === 0) return '- No domains defined.'
            return context.domains
                .map((entry) => {
                    const description = entry.description ? ` — ${entry.description}` : ''
                    return `- ${entry.name} [${entry.id}]${description}`
                })
                .join('\n')
        }
        case 'observations': {
            const records = await loadObservations(30, 'confidence')
            return formatObservationsForPrompt(records)
        }
        case 'queryable_tables':
            return formatSqlTablesForAgent()
        case 'joinable_tables':
            return formatJoinableTablesForAgent()
        case 'tokens':
            return TOKEN_REFERENCE
        default: {
            if (normalized.startsWith('table:')) {
                const tableName = normalized.slice('table:'.length)
                if (isQueryableTable(tableName)) {
                    return `Table ${tableName} columns:\n${TABLE_COLUMNS[tableName]}`
                }
                if (isJoinableTable(tableName)) {
                    const spec = AGENT_JOINABLE_TABLES[tableName]
                    const columns = spec.columns.map((column) => formatColumnSpec(column)).join('; ')
                    return `Table ${tableName}: ${spec.purpose}\ncolumns: ${columns}`
                }
                return `[Unknown table token: ${tableName}]`
            }
            return `[Unknown token: ${token}]`
        }
    }
}

export async function expandStaticPromptTokens(template: string): Promise<string> {
    const resolved = new Map<string, string>()
    let expanded = template

    for (const match of template.matchAll(TOKEN_PATTERN)) {
        const rawToken = match[1]
        if (!rawToken || isDynamicPromptToken(rawToken)) continue

        const normalized = rawToken.toLowerCase()
        if (resolved.has(normalized)) continue

        resolved.set(normalized, await resolveToken(rawToken))
    }

    for (const [normalized, value] of resolved) {
        expanded = replaceToken(expanded, normalized, value)
    }

    return expanded
}

/** Re-query live data tokens ([context], [domains], [observations]) from the database. */
export async function expandDynamicPromptTokens(template: string): Promise<string> {
    let expanded = template

    for (const token of DYNAMIC_TOKENS) {
        if (!new RegExp(`\\[${token}\\]`, 'i').test(expanded)) continue
        const value = await resolveToken(token)
        expanded = replaceToken(expanded, token, value)
    }

    return expanded
}

export async function expandPromptTokens(template: string): Promise<string> {
    const staticExpanded = await expandStaticPromptTokens(template)
    return expandDynamicPromptTokens(staticExpanded)
}

export { TOKEN_PATTERN }
