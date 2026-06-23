<script lang="ts">
    import AgentNarrativeContent from '$lib/components/llm/AgentNarrativeContent.svelte'
    import FactotumViewRenderer from '$lib/components/llm/FactotumViewRenderer.svelte'
    import type { AgentResult } from '$lib/llm/types'

    let { result }: { result: AgentResult } = $props()
</script>

<div class="space-y-4">
    {#if result.narrative}
        <section class="rounded-lg border border-base-300 bg-base-200/30 p-4">
            <p class="text-sm font-semibold uppercase tracking-wide text-base-content/60">
                Response
            </p>
            <AgentNarrativeContent source={result.narrative} class="mt-3 text-base-content/90" />
        </section>
    {/if}

    {#each result.views as view, index (view.title ?? view.sql ?? `${view.type}-${index}`)}
        <section class="rounded-lg border border-base-300 bg-base-100 p-4">
            {#if view.title}
                <h3 class="mb-3 text-lg font-semibold">{view.title}</h3>
            {/if}
            <FactotumViewRenderer {view} />
        </section>
    {/each}

    {#if result.observations}
        <section class="rounded-lg border border-base-300 bg-base-100 p-4">
            <h3 class="mb-3 text-lg font-semibold">Observations saved</h3>
            {#if result.observations.applied.length === 0 && result.observations.failed.length === 0}
                <p class="text-sm text-base-content/60">No observation changes in this run.</p>
            {:else}
                {#if result.observations.applied.length > 0}
                    <ul class="space-y-2 text-sm">
                        {#each result.observations.applied as entry (entry.record.id)}
                            <li class="rounded-lg bg-base-200/60 px-3 py-2">
                                <span class="badge badge-ghost badge-xs mr-2 uppercase">
                                    {entry.action}
                                </span>
                                <span class="font-medium text-primary">
                                    {Math.round(entry.record.confidence * 100)}%
                                </span>
                                <span class="text-base-content/80"> — {entry.record.content}</span>
                            </li>
                        {/each}
                    </ul>
                {/if}
                {#if result.observations.failed.length > 0}
                    <div class="alert alert-warning mt-3 text-sm">
                        <div class="space-y-1">
                            {#each result.observations.failed as failure, index (index)}
                                <p>{failure.error}</p>
                            {/each}
                        </div>
                    </div>
                {/if}
            {/if}
        </section>
    {/if}

    {#if result.views.length === 0 && !result.narrative && !result.observations?.applied.length}
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
