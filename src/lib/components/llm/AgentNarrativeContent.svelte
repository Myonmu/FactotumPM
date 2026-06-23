<script lang="ts">
    import MarkdownContent from '$lib/components/MarkdownContent.svelte'
    import {
        channelDisplayLabel,
        parseAgentNarrativeSegments,
    } from '$lib/llm/narrativeMarkdown'

    let {
        source,
        class: className = '',
    }: {
        source: string | null | undefined
        class?: string
    } = $props()

    const segments = $derived(parseAgentNarrativeSegments(source))
</script>

<div class="space-y-3 {className}">
    {#each segments as segment, index (index)}
        {#if segment.kind === 'visible'}
            {#if segment.content.trim()}
                <MarkdownContent source={segment.content} raw />
            {/if}
        {:else}
            <details class="rounded-lg border border-base-300/70 bg-base-200/30 p-2 text-sm">
                <summary class="cursor-pointer font-medium text-base-content/70">
                    {channelDisplayLabel(segment.channel)}
                </summary>
                <MarkdownContent source={segment.content} class="mt-2 text-base-content/75" raw />
            </details>
        {/if}
    {/each}
</div>
