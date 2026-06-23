import DOMPurify from 'dompurify'
import { Marked } from 'marked'

export type DocumentationHeading = {
    level: number
    text: string
    slug: string
}

export type DocumentationHeadingNode = DocumentationHeading & {
    children: DocumentationHeadingNode[]
}

export function buildDocumentationTree(
    headings: DocumentationHeading[],
): DocumentationHeadingNode[] {
    const root: DocumentationHeadingNode[] = []
    const stack: DocumentationHeadingNode[] = []

    for (const heading of headings) {
        const node: DocumentationHeadingNode = { ...heading, children: [] }

        while (stack.length > 0 && stack.at(-1)!.level >= heading.level) {
            stack.pop()
        }

        if (stack.length === 0) {
            root.push(node)
        } else {
            stack.at(-1)!.children.push(node)
        }

        stack.push(node)
    }

    return root
}

export function collectDocumentationAncestorSlugs(
    activeSlug: string | null,
    headings: DocumentationHeading[],
): Set<string> {
    const ancestors = new Set<string>()
    if (!activeSlug) return ancestors

    const activeIndex = headings.findIndex((heading) => heading.slug === activeSlug)
    if (activeIndex < 0) return ancestors

    let level = headings[activeIndex].level

    for (let index = activeIndex - 1; index >= 0; index -= 1) {
        const heading = headings[index]
        if (heading.level < level) {
            ancestors.add(heading.slug)
            level = heading.level
            if (level <= 1) break
        }
    }

    return ancestors
}

function cleanHeadingText(raw: string): string {
    return raw
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[*`_~]/g, '')
        .trim()
}

function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
}

function uniqueSlug(text: string, used: Map<string, number>): string {
    const base = slugify(text) || 'section'
    const count = used.get(base) ?? 0
    used.set(base, count + 1)
    return count === 0 ? base : `${base}-${count + 1}`
}

export function extractDocumentationHeadings(source: string): DocumentationHeading[] {
    const used = new Map<string, number>()
    const headings: DocumentationHeading[] = []

    for (const line of source.split('\n')) {
        const match = /^(#{1,3})\s+(.+)$/.exec(line.trim())
        if (!match) continue

        const level = match[1].length
        const text = cleanHeadingText(match[2])
        headings.push({ level, text, slug: uniqueSlug(text, used) })
    }

    return headings
}

let headingQueue: DocumentationHeading[] = []

const documentationMarked = new Marked({
    gfm: true,
    breaks: true,
})

documentationMarked.use({
    renderer: {
        heading({ tokens, depth }) {
            const text = this.parser.parseInline(tokens)
            const entry = headingQueue.shift()
            const id = entry?.slug ?? 'section'
            return `<h${depth} id="${id}">${text}</h${depth}>\n`
        },
    },
})

export function renderDocumentation(source: string): {
    html: string
    headings: DocumentationHeading[]
} {
    const headings = extractDocumentationHeadings(source)
    headingQueue = [...headings]

    const raw = documentationMarked.parse(source, { async: false })
    const html =
        typeof raw === 'string'
            ? DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } })
            : ''

    return { html, headings }
}
