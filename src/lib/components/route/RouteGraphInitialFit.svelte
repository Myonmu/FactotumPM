<script lang="ts">
    import { onMount, untrack } from 'svelte'
    import { useSvelteFlow } from '@xyflow/svelte'

    let { trigger = 0 }: { trigger?: number } = $props()

    const { fitView } = useSvelteFlow()

    function fitGraphView() {
        void fitView({ padding: 0.12 })
    }

    onMount(fitGraphView)

    $effect(() => {
        if (trigger === 0) return
        untrack(fitGraphView)
    })
</script>
