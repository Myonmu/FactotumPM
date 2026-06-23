<script lang="ts">
    import { Eye, Pencil } from 'lucide-svelte'

    import { renderMarkdown } from '$lib/markdown/renderMarkdown'

    type DetailMode = 'edit' | 'preview'

    let {
        value = null,
        onChange,
    }: {
        value?: string | null
        onChange?: (nextValue: string | null) => void
    } = $props()

    function defaultMode(detail: string | null | undefined): DetailMode {
        return detail == null || detail.trim() === '' ? 'edit' : 'preview'
    }

    let mode = $state<DetailMode>(defaultMode(value))

    const previewHtml = $derived(renderMarkdown(value))

    function handleInput(event: Event) {
        const next = (event.currentTarget as HTMLTextAreaElement).value
        onChange?.(next.trim() === '' ? null : next)
    }
</script>

<div class="flex h-full min-h-0 flex-col gap-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="text-sm font-medium">Detail</span>
        <div class="join">
            <button
                    type="button"
                    class="btn btn-xs join-item gap-1"
                    class:btn-active={mode === 'edit'}
                    onclick={() => (mode = 'edit')}
            >
                <Pencil class="h-3.5 w-3.5" />
                Edit
            </button>
            <button
                    type="button"
                    class="btn btn-xs join-item gap-1"
                    class:btn-active={mode === 'preview'}
                    onclick={() => (mode = 'preview')}
            >
                <Eye class="h-3.5 w-3.5" />
                Preview
            </button>
        </div>
    </div>

    {#if mode === 'edit'}
        <textarea
                class="textarea textarea-bordered min-h-48 w-full flex-1 resize-none font-mono text-sm leading-relaxed"
                value={value ?? ''}
                placeholder="Write markdown detail notes..."
                oninput={handleInput}
        ></textarea>
        <p class="text-xs text-base-content/60">
            Supports Markdown: headings, lists, links, code blocks, and more.
        </p>
    {:else if previewHtml}
        <div class="task-detail-markdown rounded-lg border border-base-300 bg-base-100 p-4">
            {@html previewHtml}
        </div>
    {:else}
        <div class="rounded-lg border border-dashed border-base-300 bg-base-100 px-4 py-8 text-center text-sm text-base-content/50">
            Nothing to preview yet.
        </div>
    {/if}
</div>

<style>
    :global(.task-detail-markdown) {
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
    }

    :global(.task-detail-markdown) {
        max-width: none;
        font-size: 0.925rem;
        line-height: 1.65;
    }

    :global(.task-detail-markdown :where(p, ul, ol, pre, blockquote, table, h1, h2, h3, h4)) {
        margin-top: 0.75em;
        margin-bottom: 0.75em;
    }

    :global(.task-detail-markdown :where(h1, h2, h3, h4)) {
        color: oklch(var(--bc));
        font-weight: 600;
        line-height: 1.3;
    }

    :global(.task-detail-markdown :where(a)) {
        color: oklch(var(--p));
        text-decoration: underline;
        text-underline-offset: 2px;
    }

    :global(.task-detail-markdown :where(code):not(:where(pre *))) {
        border-radius: 0.25rem;
        background: oklch(var(--b2));
        padding: 0.1rem 0.35rem;
        font-size: 0.85em;
    }

    :global(.task-detail-markdown :where(pre)) {
        overflow-x: auto;
        border-radius: var(--rounded-box, 0.5rem);
        border: 1px solid oklch(var(--bc) / 0.12);
        background: oklch(var(--b2));
        padding: 0.85rem 1rem;
    }

    :global(.task-detail-markdown :where(blockquote)) {
        border-left: 3px solid oklch(var(--p) / 0.45);
        padding-left: 0.9rem;
        color: oklch(var(--bc) / 0.78);
    }

    :global(.task-detail-markdown :where(table)) {
        width: 100%;
        border-collapse: collapse;
    }

    :global(.task-detail-markdown :where(th, td)) {
        border: 1px solid oklch(var(--bc) / 0.12);
        padding: 0.4rem 0.6rem;
    }

    :global(.task-detail-markdown :where(th)) {
        background: oklch(var(--b2));
    }
</style>
