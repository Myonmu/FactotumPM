<script lang="ts">
    import FactotumViewRenderer from '$lib/components/llm/FactotumViewRenderer.svelte'
    import type { AgentResult } from '$lib/llm/types'

    let { result }: { result: AgentResult } = $props()

    const narrativePreview = $derived.by(() => {
        const text = result.narrative?.trim() ?? ''
        if (!text) return ''

        const firstLine = text.split('\n').find((line) => line.trim()) ?? text
        return firstLine.length > 120 ? `${firstLine.slice(0, 120).trim()}…` : firstLine
    })
</script>

<div class="space-y-4">
    {#if result.narrative}
        <details class="rounded-lg border border-base-300 bg-base-200/30 p-3">
            <summary class="cursor-pointer text-sm font-medium text-base-content/80">
                Response
                {#if narrativePreview}
                    <span class="ml-2 font-normal text-base-content/50">— {narrativePreview}</span>
                {/if}
            </summary>
            <p class="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-base-content/90">
                {result.narrative}
            </p>
        </details>
    {/if}

    {#each result.views as view, index (view.title ?? view.sql ?? `${view.type}-${index}`)}
        <section class="rounded-lg border border-base-300 bg-base-100 p-4">
            {#if view.title}
                <h3 class="mb-3 text-lg font-semibold">{view.title}</h3>
            {/if}
            <FactotumViewRenderer {view} />
        </section>
    {/each}

    {#if result.views.length === 0 && !result.narrative}
        <p class="text-sm text-base-content/60">The agent returned an empty response.</p>
    {/if}

    {#if result.steps.length > 0}
        <details class="rounded-lg border border-base-300 bg-base-200/30 p-3 text-xs text-base-content/70">
            <summary class="cursor-pointer font-medium text-base-content/80">
                Agent trace ({result.steps.length} steps)
            </summary>
            <div class="mt-3 space-y-2">
                {#each result.steps as step, index (index)}
                    <details class="rounded border border-base-300/70 bg-base-100/80 p-2">
                        <summary class="cursor-pointer">
                            <span class="badge badge-ghost badge-xs mr-2 uppercase">{step.kind}</span>
                            {step.summary}
                        </summary>
                        {#if step.detail}
                            <pre
                                    class="mt-2 max-h-64 overflow-auto rounded bg-base-200 p-2 whitespace-pre-wrap text-[11px] leading-relaxed"
                            >{step.detail}</pre>
                        {/if}
                    </details>
                {/each}
            </div>
        </details>
    {/if}
</div>
