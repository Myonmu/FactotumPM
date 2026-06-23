import type {
    AgentToolCall,
    AgentToolResult,
    FactotumViewType,
    ParsedFactotumView,
    ParsedObservation,
} from './types'
import { VIEW_TYPES } from './types'
import { parseViewBody } from './viewBodyParser'

const TOOL_BLOCK_PATTERN = /<factotum-tool>([\s\S]*?)<\/factotum-tool>/gi
const TOOL_RESULT_BLOCK_PATTERN =
    /<factotum-tool-result>([\s\S]*?)<\/factotum-tool-result>/gi
const VIEW_BLOCK_PATTERN = /<factotum-view([^>]*)>([\s\S]*?)<\/factotum-view>/gi
const OBSERVATION_BLOCK_PATTERN =
    /<factotum-observation>([\s\S]*?)<\/factotum-observation>/gi

const THINK_BLOCK = new RegExp(
    '<' + 'think' + '>[\\s\\S]*?<' + '/think' + '>',
    'gi',
)
const REDACTED_THINKING_BLOCK = new RegExp(
    '<think>[\\s\\S]*?</redacted_reasoning>',
    'gi',
)
const REASONING_BLOCK = new RegExp(
    '<' + 'reasoning' + '>[\\s\\S]*?<' + '/reasoning' + '>',
    'gi',
)

/** Model reasoning / channel wrappers some LLMs emit in assistant text. */
const MODEL_REASONING_BLOCK_PATTERNS = [
    THINK_BLOCK,
    REDACTED_THINKING_BLOCK,
    REASONING_BLOCK,
    /<thinking>[\s\S]*?<\/thinking>/gi,
    /<analysis>[\s\S]*?<\/analysis>/gi,
] as const

const HARMONY_CHANNEL_SEGMENT_PATTERN =
    /<\|(?:start\|>[^<]*)?<\|channel\|>([^<]+?)<\|message\|>([\s\S]*?)(?:<\|end\||<\|return\|>)/gi

/** Asymmetric delimiters some models emit: `<|channel>thought` … `<channel|>`. */
const PAIRED_CHANNEL_SEGMENT_PATTERN =
    /<\|channel\|?>([^\n<]+)\r?\n([\s\S]*?)<channel\|>/gi

const HARMONY_CONTROL_TOKEN_PATTERN =
    /<\|(?:start|end|return|call|constrain|message|channel)\|>/gi

const LEAKED_CHANNEL_DELIMITER_PATTERN = /<\|channel\|?>(?:[^\n<]+)?|<channel\|>/gi

const ORPHAN_CHANNEL_TAG_PATTERN =
    /<\/?(?:think(?:ing)?|redacted_thinking|redacted_reasoning|reasoning|analysis|factotum-[\w-]+)[^>]*>/gi

export type NarrativeSegment =
    | { kind: 'visible'; content: string }
    | { kind: 'channel'; channel: string; content: string }

interface NarrativeSegmentMarker {
    start: number
    end: number
    channel: string
    content: string
    collapse: boolean
}

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

export function stripToolResultBlocks(content: string): string {
    return content.replace(TOOL_RESULT_BLOCK_PATTERN, '').trim()
}

export function stripFactotumProtocolBlocks(content: string): string {
    return stripObservationBlocks(
        stripViewBlocks(stripToolResultBlocks(stripToolBlocks(content))),
    )
}

function normalizeChannelName(raw: string): string {
    const trimmed = raw.trim()
    if (!trimmed) return 'channel'
    return trimmed.split(/\s+/)[0] ?? trimmed
}

function shouldCollapseChannel(channel: string): boolean {
    const normalized = normalizeChannelName(channel).toLowerCase()
    return normalized !== 'final'
}

function collectSegmentMarkers(content: string): NarrativeSegmentMarker[] {
    const markers: NarrativeSegmentMarker[] = []

    for (const match of content.matchAll(PAIRED_CHANNEL_SEGMENT_PATTERN)) {
        const channel = normalizeChannelName(match[1] ?? '')
        const body = match[2]?.trim() ?? ''
        if (!body) continue

        const start = match.index ?? 0
        markers.push({
            start,
            end: start + match[0].length,
            channel,
            content: body,
            collapse: shouldCollapseChannel(channel),
        })
    }

    for (const match of content.matchAll(HARMONY_CHANNEL_SEGMENT_PATTERN)) {
        const channel = normalizeChannelName(match[1] ?? '')
        const body = match[2]?.trim() ?? ''
        if (!body) continue

        const start = match.index ?? 0
        markers.push({
            start,
            end: start + match[0].length,
            channel,
            content: body,
            collapse: shouldCollapseChannel(channel),
        })
    }

    if (markers.length === 0 && content.includes('<|channel') && !content.includes('<channel|>')) {
        const unclosed = content.match(/^<\|channel\|?>([^\n<]+)\r?\n([\s\S]*)$/)
        if (unclosed) {
            markers.push({
                start: 0,
                end: content.length,
                channel: normalizeChannelName(unclosed[1] ?? ''),
                content: unclosed[2]?.trim() ?? '',
                collapse: true,
            })
        }
    }

    for (const pattern of MODEL_REASONING_BLOCK_PATTERNS) {
        for (const match of content.matchAll(pattern)) {
            const body = match[0]
                .replace(/^<[^>]+>/, '')
                .replace(/<\/[^>]+>$/, '')
                .trim()
            if (!body) continue

            const start = match.index ?? 0
            markers.push({
                start,
                end: start + match[0].length,
                channel: 'reasoning',
                content: body,
                collapse: true,
            })
        }
    }

    markers.sort((left, right) => left.start - right.start)

    const deduped: NarrativeSegmentMarker[] = []
    let lastEnd = 0
    for (const marker of markers) {
        if (marker.start < lastEnd) continue
        deduped.push(marker)
        lastEnd = marker.end
    }

    return deduped
}

function cleanVisibleNarrativeText(content: string): string {
    return content
        .replace(HARMONY_CONTROL_TOKEN_PATTERN, '')
        .replace(LEAKED_CHANNEL_DELIMITER_PATTERN, '')
        .replace(/<\|start\|>[^<\n]*/gi, '')
        .replace(ORPHAN_CHANNEL_TAG_PATTERN, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

function collectVisibleRegions(content: string): string[] {
    const markers = collectSegmentMarkers(content)
    const regions: string[] = []
    let cursor = 0

    for (const marker of markers) {
        const before = content.slice(cursor, marker.start)
        if (before.trim()) {
            regions.push(before)
        }
        if (!marker.collapse) {
            regions.push(marker.content)
        }
        cursor = marker.end
    }

    const tail = content.slice(cursor)
    if (tail.trim()) {
        regions.push(tail)
    }

    return regions
}

/** User-facing assistant text: everything outside collapsed model channels. */
export function extractProtocolParseableContent(content: string): string {
    return collectVisibleRegions(content).join('\n\n').trim()
}

export function parseNarrativeSegments(content: string): NarrativeSegment[] {
    const markers = collectSegmentMarkers(content)
    const segments: NarrativeSegment[] = []
    let cursor = 0

    const pushVisible = (text: string) => {
        const cleaned = cleanVisibleNarrativeText(stripFactotumProtocolBlocks(text))
        if (!cleaned) return
        const last = segments[segments.length - 1]
        if (last?.kind === 'visible') {
            last.content = `${last.content}\n\n${cleaned}`.trim()
            return
        }
        segments.push({ kind: 'visible', content: cleaned })
    }

    for (const marker of markers) {
        pushVisible(content.slice(cursor, marker.start))
        if (marker.collapse) {
            segments.push({
                kind: 'channel',
                channel: marker.channel,
                content: marker.content,
            })
        } else {
            pushVisible(marker.content)
        }
        cursor = marker.end
    }

    pushVisible(content.slice(cursor))
    return segments
}

export function stripModelChannelTags(content: string): string {
    return parseNarrativeSegments(content)
        .filter((segment): segment is Extract<NarrativeSegment, { kind: 'visible' }> => segment.kind === 'visible')
        .map((segment) => segment.content)
        .join('\n\n')
        .trim()
}

/** Remove protocol blocks and model channel tags before narrative display. */
export function stripAllChannelTags(content: string): string {
    return stripModelChannelTags(stripFactotumProtocolBlocks(content)).replace(/\n{3,}/g, '\n\n').trim()
}

export function stripObservationBlocks(content: string): string {
    return content.replace(OBSERVATION_BLOCK_PATTERN, '').trim()
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

export function parseObservationBlocks(content: string): ParsedObservation[] {
    const observations: ParsedObservation[] = []

    for (const match of content.matchAll(OBSERVATION_BLOCK_PATTERN)) {
        const payload = match[1]?.trim()
        if (!payload) continue

        try {
            const parsed = JSON.parse(payload) as Partial<ParsedObservation>
            const action = parsed.action
            const confidence = parsed.confidence

            if (action !== 'create' && action !== 'update') continue
            if (confidence == null) continue

            observations.push({
                action,
                id: typeof parsed.id === 'string' ? parsed.id.trim() : undefined,
                content: typeof parsed.content === 'string' ? parsed.content : undefined,
                confidence: Number(confidence),
            })
        } catch {
            // ignore malformed observation blocks
        }
    }

    return observations
}

export function formatToolResult(result: AgentToolResult): string {
    return `<factotum-tool-result>${JSON.stringify(result)}</factotum-tool-result>`
}

/** Merge API `reasoning_content` into the channel format the narrative renderer understands. */
export function combineAssistantResponse(
    content: string,
    reasoningContent: string | null | undefined,
): string {
    const visible = content.trim()
    const reasoning = reasoningContent?.trim()
    if (!reasoning) return visible
    if (!visible) {
        return `<|channel>reasoning\n${reasoning}\n<channel|>`
    }
    return `<|channel>reasoning\n${reasoning}\n<channel|>${visible}`
}

export function formatAssistantStepDetail(
    content: string,
    reasoningContent: string | null | undefined,
): string {
    const parts: string[] = []
    const reasoning = reasoningContent?.trim()
    if (reasoning) {
        parts.push('Reasoning:', reasoning, '')
    }
    const visible = content.trim()
    if (visible) {
        parts.push('Content:', visible)
    }
    return parts.join('\n')
}

export function extractNarrative(content: string): string {
    return content.trim()
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
