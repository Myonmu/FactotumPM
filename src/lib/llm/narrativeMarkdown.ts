import { renderMarkdown } from '$lib/markdown/renderMarkdown'

import { parseNarrativeSegments, type NarrativeSegment } from './agentProtocol'

export function parseAgentNarrativeSegments(
    narrative: string | null | undefined,
): NarrativeSegment[] {
    return parseNarrativeSegments(narrative ?? '')
}

export function channelDisplayLabel(channel: string): string {
    const normalized = channel.trim().toLowerCase()
    switch (normalized) {
        case 'analysis':
            return 'Analysis'
        case 'commentary':
            return 'Commentary'
        case 'reasoning':
            return 'Reasoning'
        case 'thinking':
            return 'Thinking'
        case 'thought':
            return 'Thought'
        default:
            return channel.trim() || 'Channel'
    }
}

export function renderPlainMarkdownHtml(source: string | null | undefined): string {
    return renderMarkdown(source)
}

/** Legacy helper: visible narrative only (collapsed channels omitted). */
export function renderAgentNarrativeHtml(narrative: string | null | undefined): string {
    return renderPlainMarkdownHtml(visibleNarrativeText(narrative))
}

export function visibleNarrativeText(narrative: string | null | undefined): string {
    return parseAgentNarrativeSegments(narrative)
        .filter((segment): segment is Extract<NarrativeSegment, { kind: 'visible' }> => segment.kind === 'visible')
        .map((segment) => segment.content)
        .join('\n\n')
        .trim()
}
