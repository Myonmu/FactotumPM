<script lang="ts">
    import { Unlink } from 'lucide-svelte'

    import TaskRefCard from '$lib/components/TaskRefCard.svelte'
    import type { DomainOption, TaskChildTreeNode, TaskRef } from '$lib/db/dataView'
    import TaskChildTree from '$lib/components/TaskChildTree.svelte'

    let {
        nodes,
        domains = [],
        taskRefForChild,
        childLinkBusy = false,
        depth = 0,
        onInspectTask,
        onUnlink,
    }: {
        nodes: TaskChildTreeNode[]
        domains?: DomainOption[]
        taskRefForChild: (task: TaskChildTreeNode['task']) => TaskRef
        childLinkBusy?: boolean
        depth?: number
        onInspectTask?: (taskId: string) => void | Promise<void>
        onUnlink?: (taskId: string) => void | Promise<void>
    } = $props()

    const lineColor = 'oklch(var(--bc) / 0.28)'
</script>

{#snippet treeNodeRow(node: TaskChildTreeNode)}
    <div class="task-tree-entry">
        {#if depth > 0}
            <span class="task-tree-branch" style:--line-color={lineColor} aria-hidden="true"></span>
        {/if}
        <div class="task-tree-row">
            <TaskRefCard
                    class="min-w-0"
                    task={taskRefForChild(node.task)}
                    {domains}
                    onclick={onInspectTask ? () => onInspectTask(node.task.id) : undefined}
            />
            {#if onUnlink}
                <button
                        type="button"
                        class="btn btn-ghost btn-xs btn-square shrink-0"
                        title="Remove parent-child link"
                        disabled={childLinkBusy}
                        onclick={() => onUnlink(node.task.id)}
                >
                    <Unlink class="h-3.5 w-3.5" />
                </button>
            {/if}
        </div>
    </div>
{/snippet}

{#if depth === 0}
    <div class="task-forest">
        {#each nodes as node (node.task.id)}
            <div class="task-tree">
                {@render treeNodeRow(node)}
                {#if node.children.length > 0}
                    <div class="task-tree-descendants" style:--line-color={lineColor}>
                        <TaskChildTree
                                nodes={node.children}
                                {domains}
                                {taskRefForChild}
                                {childLinkBusy}
                                depth={1}
                                {onInspectTask}
                                {onUnlink}
                        />
                    </div>
                {/if}
            </div>
        {/each}
    </div>
{:else}
    {#each nodes as node, index (node.task.id)}
        <div
                class="task-tree-node"
                class:task-tree-node--last={index === nodes.length - 1}
        >
            {@render treeNodeRow(node)}
            {#if node.children.length > 0}
                <div class="task-tree-descendants" style:--line-color={lineColor}>
                    <TaskChildTree
                            nodes={node.children}
                            {domains}
                            {taskRefForChild}
                            {childLinkBusy}
                            depth={depth + 1}
                            {onInspectTask}
                            {onUnlink}
                    />
                </div>
            {/if}
        </div>
    {/each}
{/if}

<style>
    .task-forest {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .task-tree-descendants {
        margin-top: 0.125rem;
        margin-left: 0.75rem;
        padding-left: 0.875rem;
        border-left: 1px solid var(--line-color, oklch(var(--bc) / 0.28));
    }

    .task-tree-node {
        position: relative;
        padding: 0.125rem 0;
    }

    .task-tree-node--last:not(:has(> .task-tree-descendants))::after {
        content: '';
        position: absolute;
        left: -0.875rem;
        top: 1.125rem;
        bottom: 0;
        width: 2px;
        margin-left: -1px;
        background: oklch(var(--b1));
        pointer-events: none;
    }

    .task-tree-entry {
        display: flex;
        align-items: center;
        min-width: 0;
    }

    .task-tree-branch {
        flex: 0 0 0.875rem;
        align-self: center;
        height: 0;
        margin-left: -0.875rem;
        border-top: 1px solid var(--line-color, oklch(var(--bc) / 0.28));
    }

    .task-tree-row {
        display: grid;
        min-width: 0;
        flex: 1 1 auto;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.5rem;
    }
</style>
