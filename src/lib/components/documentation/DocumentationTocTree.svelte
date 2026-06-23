<script lang="ts">
    import DocumentationTocTree from '$lib/components/documentation/DocumentationTocTree.svelte'
    import type { DocumentationHeading, DocumentationHeadingNode } from '$lib/markdown/documentation'

    let {
        nodes,
        activeSlug = null,
        ancestorSlugs = new Set<string>(),
        depth = 0,
        onSelect,
    }: {
        nodes: DocumentationHeadingNode[]
        activeSlug?: string | null
        ancestorSlugs?: Set<string>
        depth?: number
        onSelect: (heading: DocumentationHeading, event: MouseEvent) => void
    } = $props()
</script>

<ul class="doc-tree" class:doc-tree-nested={depth > 0}>
    {#each nodes as node (node.slug)}
        <li class="doc-tree-item">
            <a
                    href="#{node.slug}"
                    class="doc-nav-link"
                    class:doc-nav-active={activeSlug === node.slug}
                    class:doc-nav-ancestor={ancestorSlugs.has(node.slug)}
                    onclick={(event) => onSelect(node, event)}
            >
                {node.text}
            </a>
            {#if node.children.length > 0}
                <DocumentationTocTree
                        nodes={node.children}
                        {activeSlug}
                        {ancestorSlugs}
                        depth={depth + 1}
                        {onSelect}
                />
            {/if}
        </li>
    {/each}
</ul>

<style>
    :global(.doc-tree) {
        list-style: none;
        margin: 0;
        padding: 0;
    }

    :global(.doc-tree-nested) {
        margin-top: 0.125rem;
        margin-left: 0.625rem;
        padding-left: 0.625rem;
        border-left: 1px solid oklch(var(--bc) / 0.12);
    }

    :global(.doc-tree-item + .doc-tree-item) {
        margin-top: 0.125rem;
    }
</style>
