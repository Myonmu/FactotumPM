<script lang="ts">
    import DocumentationTocTree from '$lib/components/documentation/DocumentationTocTree.svelte'
    import {
        buildDocumentationTree,
        collectDocumentationAncestorSlugs,
        renderDocumentation,
        type DocumentationHeading,
    } from '$lib/markdown/documentation'

    let {
        markdown,
    }: {
        markdown: string
    } = $props()

    let contentEl = $state<HTMLElement | null>(null)
    let activeSlug = $state<string | null>(null)
    let scrollSpyLockedUntil = 0

    const rendered = $derived(renderDocumentation(markdown))
    const headings = $derived(rendered.headings)
    const headingTree = $derived(buildDocumentationTree(headings))
    const ancestorSlugs = $derived(collectDocumentationAncestorSlugs(activeSlug, headings))

    function headingTopInContainer(element: HTMLElement, container: HTMLElement): number {
        return (
            element.getBoundingClientRect().top -
            container.getBoundingClientRect().top +
            container.scrollTop
        )
    }

    function resolveActiveHeading(): DocumentationHeading | null {
        if (!contentEl || headings.length === 0) return null

        const scrollTop = contentEl.scrollTop
        const threshold = 56

        if (contentEl.scrollHeight - scrollTop - contentEl.clientHeight < 48) {
            return headings.at(-1) ?? null
        }

        let current = headings[0]

        for (const heading of headings) {
            const element = contentEl.querySelector<HTMLElement>(`#${CSS.escape(heading.slug)}`)
            if (!element) continue

            if (headingTopInContainer(element, contentEl) - threshold <= scrollTop) {
                current = heading
            }
        }

        return current
    }

    function updateActiveHeading() {
        if (!contentEl || headings.length === 0) return
        if (Date.now() < scrollSpyLockedUntil) return

        activeSlug = resolveActiveHeading()?.slug ?? headings[0]?.slug ?? null
    }

    function scrollToHeading(heading: DocumentationHeading, event: MouseEvent) {
        event.preventDefault()

        const target = contentEl?.querySelector<HTMLElement>(`#${CSS.escape(heading.slug)}`)
        if (!target || !contentEl) return

        activeSlug = heading.slug
        scrollSpyLockedUntil = Date.now() + 700

        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        history.replaceState(null, '', `#${heading.slug}`)
    }

    $effect(() => {
        markdown
        headings

        if (!contentEl || typeof window === 'undefined') return

        const hash = window.location.hash.slice(1)
        const hashHeading = hash ? headings.find((heading) => heading.slug === hash) : null

        requestAnimationFrame(() => {
            if (!contentEl) return

            if (hashHeading) {
                const target = contentEl.querySelector<HTMLElement>(`#${CSS.escape(hashHeading.slug)}`)
                target?.scrollIntoView({ block: 'start' })
                activeSlug = hashHeading.slug
                return
            }

            updateActiveHeading()
        })
    })

    $effect(() => {
        if (!contentEl) return

        updateActiveHeading()

        const onScroll = () => updateActiveHeading()
        contentEl.addEventListener('scroll', onScroll, { passive: true })

        return () => {
            contentEl.removeEventListener('scroll', onScroll)
        }
    })
</script>

<div class="flex h-full min-h-0">
    <aside class="doc-index flex w-56 shrink-0 flex-col border-r border-base-300 bg-base-100">
        <div class="border-b border-base-300 px-4 py-3">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-base-content/60">Contents</h2>
        </div>
        <nav class="min-h-0 flex-1 overflow-y-auto p-3">
            <DocumentationTocTree
                    nodes={headingTree}
                    {activeSlug}
                    {ancestorSlugs}
                    onSelect={scrollToHeading}
            />
        </nav>
    </aside>

    <article
            bind:this={contentEl}
            class="documentation-content prose prose-sm max-w-none min-h-0 flex-1 overflow-y-auto bg-base-100 p-6"
    >
        {@html rendered.html}
    </article>
</div>

<style>
    :global(.doc-nav-link) {
        display: block;
        border-radius: var(--rounded-btn, 0.5rem);
        padding: 0.375rem 0.5rem;
        font-size: 0.875rem;
        line-height: 1.375;
        color: oklch(var(--bc) / 0.72);
        transition:
            background-color 150ms ease,
            color 150ms ease;
    }

    :global(.doc-nav-link:hover) {
        background: oklch(var(--b3));
        color: oklch(var(--bc));
    }

    :global(.doc-nav-link.doc-nav-ancestor) {
        color: oklch(var(--bc) / 0.88);
        font-weight: 500;
    }

    :global(.doc-nav-link.doc-nav-active) {
        background: oklch(var(--p) / 0.14);
        color: oklch(var(--p));
        font-weight: 600;
    }

    :global(.doc-nav-link.doc-nav-active:hover) {
        background: oklch(var(--p) / 0.22);
        color: oklch(var(--p));
    }

    :global(.documentation-content) {
        --tw-prose-body: oklch(var(--bc) / 0.88);
        --tw-prose-headings: oklch(var(--bc));
        --tw-prose-links: oklch(var(--p));
        --tw-prose-bold: oklch(var(--bc));
        --tw-prose-code: oklch(var(--bc));
        --tw-prose-pre-bg: oklch(var(--b2));
    }

    :global(.documentation-content :where(a:hover)) {
        color: oklch(var(--pf, var(--p)));
    }

    :global(.documentation-content :where(h1, h2, h3)) {
        scroll-margin-top: 1rem;
    }
</style>
