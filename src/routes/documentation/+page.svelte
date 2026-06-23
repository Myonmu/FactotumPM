<script lang="ts">
    import DocumentationViewer from '$lib/components/documentation/DocumentationViewer.svelte'

    let { data } = $props()
</script>

<div class="flex h-full min-h-0 flex-col bg-base-200">
    <div class="border-b border-base-300 bg-base-100 px-4 py-3">
        <h1 class="text-lg font-semibold">Documentation</h1>
        <p class="text-sm text-base-content/60">Guides and reference for using Factotum.</p>
    </div>

    <div class="min-h-0 flex-1">
        <DocumentationViewer markdown={data.markdown} />
    </div>
</div>
