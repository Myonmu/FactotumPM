import DOMPurify from 'dompurify'
import { marked } from 'marked'

marked.setOptions({
    gfm: true,
    breaks: true,
})

export function renderMarkdown(source: string | null | undefined): string {
    if (!source?.trim()) return ''

    const raw = marked.parse(source, { async: false })
    if (typeof raw !== 'string') return ''

    return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } })
}
