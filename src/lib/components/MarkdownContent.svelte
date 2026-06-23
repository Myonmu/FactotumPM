<script lang="ts">
    import { renderAgentNarrativeHtml, renderPlainMarkdownHtml } from '$lib/llm/narrativeMarkdown'

    let {
        source,
        class: className = '',
        raw = false,
    }: {
        source: string | null | undefined
        class?: string
        raw?: boolean
    } = $props()

    const html = $derived(
        raw ? renderPlainMarkdownHtml(source) : renderAgentNarrativeHtml(source),
    )
</script>

{#if html}
    <div class="factotum-markdown {className}">{@html html}</div>
{/if}

<style>
    :global(.factotum-markdown) {
        --tw-prose-body: oklch(var(--bc) / 0.88);
        --tw-prose-headings: oklch(var(--bc));
        --tw-prose-lead: oklch(var(--bc) / 0.75);
        --tw-prose-links: oklch(var(--p));
        --tw-prose-bold: oklch(var(--bc));
        --tw-prose-counters: oklch(var(--bc) / 0.65);
        --tw-prose-bullets: oklch(var(--bc) / 0.45);
        --tw-prose-hr: oklch(var(--bc) / 0.18);
        --tw-prose-quotes: oklch(var(--bc) / 0.75);
        --tw-prose-quote-borders: oklch(var(--p) / 0.45);
        --tw-prose-captions: oklch(var(--bc) / 0.65);
        --tw-prose-code: oklch(var(--bc));
        --tw-prose-pre-code: oklch(var(--bc));
        --tw-prose-pre-bg: oklch(var(--b2));
        --tw-prose-th-borders: oklch(var(--bc) / 0.2);
        --tw-prose-td-borders: oklch(var(--bc) / 0.12);

        max-width: none;
        font-size: 0.925rem;
        line-height: 1.65;
    }

    :global(.factotum-markdown :where(p, ul, ol, pre, blockquote, table, h1, h2, h3, h4)) {
        margin-top: 0.75em;
        margin-bottom: 0.75em;
    }

    :global(.factotum-markdown :where(h1, h2, h3, h4)) {
        color: oklch(var(--bc));
        font-weight: 600;
        line-height: 1.3;
    }

    :global(.factotum-markdown :where(a)) {
        color: oklch(var(--p));
        text-decoration: underline;
        text-underline-offset: 2px;
    }

    :global(.factotum-markdown :where(code):not(:where(pre *))) {
        border-radius: 0.25rem;
        background: oklch(var(--b2));
        padding: 0.1rem 0.35rem;
        font-size: 0.85em;
    }

    :global(.factotum-markdown :where(pre)) {
        overflow-x: auto;
        border-radius: var(--rounded-box, 0.5rem);
        border: 1px solid oklch(var(--bc) / 0.12);
        background: oklch(var(--b2));
        padding: 0.85rem 1rem;
    }

    :global(.factotum-markdown :where(blockquote)) {
        border-left: 3px solid oklch(var(--p) / 0.45);
        padding-left: 0.9rem;
        color: oklch(var(--bc) / 0.78);
    }

    :global(.factotum-markdown :where(table)) {
        width: 100%;
        border-collapse: collapse;
    }

    :global(.factotum-markdown :where(th, td)) {
        border: 1px solid oklch(var(--bc) / 0.12);
        padding: 0.4rem 0.6rem;
    }

    :global(.factotum-markdown :where(th)) {
        background: oklch(var(--b2));
    }
</style>
