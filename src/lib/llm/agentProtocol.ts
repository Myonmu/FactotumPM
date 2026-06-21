import type {
    AgentToolCall,
    AgentToolResult,
    FactotumViewType,
    ParsedFactotumView,
} from './types'
import { VIEW_TYPES } from './types'
import { parseViewBody } from './viewBodyParser'

const TOOL_BLOCK_PATTERN = /<factotum-tool>([\s\S]*?)<\/factotum-tool>/gi
const VIEW_BLOCK_PATTERN = /<factotum-view([^>]*)>([\s\S]*?)<\/factotum-view>/gi

function parseAttributes(raw: string): Record<string, string> {
    const attributes: Record<string, string> = {}
    const pattern = /(\w+)=("([^"]*)"|'([^']*)')/g

    for (const match of raw.matchAll(pattern)) {
        attributes[match[1]] = match[3] ?? match[4] ?? ''
    }

    return attributes
}

function isViewType(value: string): value is FactotumViewType {
    return (VIEW_TYPES as readonly string[]).includes(value)
}

export function stripToolBlocks(content: string): string {
    return content.replace(TOOL_BLOCK_PATTERN, '').trim()
}

export function stripViewBlocks(content: string): string {
    return content.replace(VIEW_BLOCK_PATTERN, '').trim()
}

export function parseToolCalls(content: string): AgentToolCall[] {
    const calls: AgentToolCall[] = []

    for (const match of content.matchAll(TOOL_BLOCK_PATTERN)) {
        const payload = match[1]?.trim()
        if (!payload) continue

        try {
            const parsed = JSON.parse(payload) as Partial<AgentToolCall>
            if (parsed.action === 'query' && typeof parsed.sql === 'string' && parsed.sql.trim()) {
                calls.push({ action: 'query', sql: parsed.sql.trim() })
            }
        } catch {
            // ignore malformed tool blocks
        }
    }

    return calls
}

export function parseViewBlocks(content: string): ParsedFactotumView[] {
    const views: ParsedFactotumView[] = []

    for (const match of content.matchAll(VIEW_BLOCK_PATTERN)) {
        const attributes = parseAttributes(match[1] ?? '')
        const body = match[2]?.trim() ?? ''
        const type = attributes.type ?? 'table'

        if (!body || !isViewType(type)) continue

        const parsedBody = parseViewBody(body)

        if (parsedBody.kind === 'sql') {
            views.push({
                type,
                title: attributes.title ?? null,
                sql: parsedBody.sql,
            })
            continue
        }

        if (parsedBody.kind === 'inline') {
            views.push({
                type,
                title: attributes.title ?? null,
                inlineColumns: parsedBody.columns,
                inlineRecords: parsedBody.records,
                inlineWarning: parsedBody.warning,
                rawBody: body,
            })
            continue
        }

        views.push({
            type,
            title: attributes.title ?? null,
            parseError: parsedBody.error,
            rawBody: parsedBody.raw,
        })
    }

    return views
}

export function formatToolResult(result: AgentToolResult): string {
    return `<factotum-tool-result>${JSON.stringify(result)}</factotum-tool-result>`
}

export function extractNarrative(content: string): string {
    return stripViewBlocks(stripToolBlocks(content)).trim()
}

export const AGENT_TOOL_INSTRUCTIONS = `
When you need database data, emit:
<factotum-tool>{"action":"query","sql":"SELECT ... LIMIT 20"}</factotum-tool>

Present final UI blocks as:
<factotum-view type="table" title="Title">
SELECT id, col1, col2 FROM task LIMIT 20
</factotum-view>

The body must be ONLY a SELECT query (SQL). Always include \`id\` (or SELECT *) for entity views.
Never paste result rows, markdown tables, or JSON inside <factotum-view>.
`.trim()
