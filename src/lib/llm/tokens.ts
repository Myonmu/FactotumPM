import {
    buildRecommendationContext,
    formatContextForPrompt,
} from './contextBuilder'
import { FACTOTUM_SCHEMA_CONTEXT } from './schemaContext'
import { QUERYABLE_TABLES, type QueryableTableName } from './types'

export const TOKEN_REFERENCE = `
Available special tokens (replaced before the prompt is sent to the LLM):

- [schema] — full SQLite schema and design notes for FactotumPM
- [context] — live summary: domains, recent session activity, open task count
- [domains] — list of domains with ids, names, descriptions
- [queryable_tables] — entity tables the agent may SELECT from (not edge tables)
- [tokens] — this reference list
- [table:NAME] — columns for one queryable table, e.g. [table:task], [table:session]

Edge/junction tables (session_edge, task_status_edge, task_dependency) are omitted
because they are internal wiring; join through them in SQL when needed.

Result extraction: <factotum-view> bodies must contain ONLY a SELECT query (optional sql code fences).
Entity views (task, session, domain, aftermath, task_status) must SELECT \`id\` (or SELECT *).
The app hydrates ref cards from primary keys — never paste markdown tables, JSON, CSV, or tool-result rows.
`.trim()

const TABLE_COLUMNS: Record<QueryableTableName, string> = {
    task: 'id, title, description, detail, uncertainty, complexity, effort, domain_id, parent_task_id, is_trophy, task_status_id, created_at, updated_at',
    domain: 'id, parent_domain_id, name, description, icon, color',
    session: 'id, started_at, ended_at, status (0=Planned,1=Started,2=Finished,3=NoLongerNeeded), aftermath_id',
    aftermath: 'id, score, description, icon, color',
    task_status: 'id, name, is_initial, is_terminal, color, pos_x, pos_y, kanban_pos_x, kanban_pos_y',
}

const TOKEN_PATTERN = /\[([a-z_]+(?::[a-z_]+)?)\]/gi

function isQueryableTable(name: string): name is QueryableTableName {
    return (QUERYABLE_TABLES as readonly string[]).includes(name)
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
        case 'queryable_tables':
            return QUERYABLE_TABLES.map(
                (table) =>
                    `- ${table}: ${TABLE_COLUMNS[table]}`,
            ).join('\n')
        case 'tokens':
            return TOKEN_REFERENCE
        default: {
            if (normalized.startsWith('table:')) {
                const tableName = normalized.slice('table:'.length)
                if (!isQueryableTable(tableName)) {
                    return `[Unknown table token: ${tableName}]`
                }
                return `Table ${tableName} columns: ${TABLE_COLUMNS[tableName]}`
            }
            return `[Unknown token: ${token}]`
        }
    }
}

export async function expandPromptTokens(template: string): Promise<string> {
    const tokens = [...template.matchAll(TOKEN_PATTERN)].map((match) => match[1])
    const uniqueTokens = [...new Set(tokens)]

    let expanded = template
    for (const token of uniqueTokens) {
        const value = await resolveToken(token)
        expanded = expanded.replaceAll(`[${token}]`, value)
    }

    return expanded
}

export { TOKEN_PATTERN }
