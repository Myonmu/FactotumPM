<script lang="ts">
    import { FolderPlus, Plus, Trash2 } from 'lucide-svelte'

    import TrophyFilterConditionEditor from '$lib/components/trophy/TrophyFilterConditionEditor.svelte'
    import TrophyFilterGroupEditor from '$lib/components/trophy/TrophyFilterGroupEditor.svelte'
    import type { DomainOption } from '$lib/db/dataView'
    import type { FilterGroup, FilterNode } from '$lib/kanban/filterTypes'
    import { createFilterGroup, removeFilterNode, updateFilterTree } from '$lib/kanban/filterUtils'
    import { createTrophyFilterCondition } from '$lib/trophy/trophyFields'

    let {
        group,
        depth = 0,
        domains = [],
        statuses = [],
        onChange,
        onRemove,
    }: {
        group: FilterGroup
        depth?: number
        domains?: DomainOption[]
        statuses?: { id: string; title: string }[]
        onChange?: (nextGroup: FilterGroup) => void
        onRemove?: () => void
    } = $props()

    function emitChange(nextGroup: FilterGroup) {
        onChange?.(nextGroup)
    }

    function updateGroupLogic(logic: FilterGroup['logic']) {
        emitChange({ ...group, logic })
    }

    function updateChild(index: number, nextChild: FilterNode) {
        emitChange({
            ...group,
            children: group.children.map((child, childIndex) =>
                childIndex === index ? nextChild : child,
            ),
        })
    }

    function removeChild(nodeId: string) {
        emitChange(removeFilterNode(group, nodeId))
    }

    function addCondition() {
        emitChange({ ...group, children: [...group.children, createTrophyFilterCondition()] })
    }

    function addGroup() {
        emitChange({ ...group, children: [...group.children, createFilterGroup()] })
    }

    function updateNestedGroup(nodeId: string, nextGroup: FilterGroup) {
        emitChange(updateFilterTree(group, nodeId, () => nextGroup) as FilterGroup)
    }
</script>

<div class="rounded-box border border-base-300 bg-base-100/70 p-3" class:border-dashed={depth > 0}>
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
            <span class="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                {depth === 0 ? 'Match' : 'Group'}
            </span>
            <div class="join">
                <button
                        type="button"
                        class="btn btn-xs join-item"
                        class:btn-primary={group.logic === 'and'}
                        onclick={() => updateGroupLogic('and')}
                >
                    All (AND)
                </button>
                <button
                        type="button"
                        class="btn btn-xs join-item"
                        class:btn-primary={group.logic === 'or'}
                        onclick={() => updateGroupLogic('or')}
                >
                    Any (OR)
                </button>
            </div>
        </div>

        {#if depth > 0}
            <button type="button" class="btn btn-ghost btn-xs gap-1 text-error" onclick={() => onRemove?.()}>
                <Trash2 class="h-3.5 w-3.5" />
                Remove group
            </button>
        {/if}
    </div>

    {#if group.children.length === 0}
        <p class="mb-3 text-xs text-base-content/50">
            No filter rules yet. Add a condition or nested group.
        </p>
    {:else}
        <div class="space-y-2">
            {#each group.children as child, index (child.id)}
                <div class="flex items-start gap-2">
                    {#if index > 0}
                        <span class="mt-2 w-10 shrink-0 text-center text-[10px] font-semibold uppercase text-base-content/50">
                            {group.logic}
                        </span>
                    {:else}
                        <span class="mt-2 w-10 shrink-0"></span>
                    {/if}

                    <div class="min-w-0 flex-1">
                        {#if child.type === 'condition'}
                            <TrophyFilterConditionEditor
                                    condition={child}
                                    {domains}
                                    {statuses}
                                    onChange={(nextCondition) => updateChild(index, nextCondition)}
                                    onRemove={() => removeChild(child.id)}
                            />
                        {:else}
                            <TrophyFilterGroupEditor
                                    group={child}
                                    depth={depth + 1}
                                    {domains}
                                    {statuses}
                                    onChange={(nextGroup) => updateNestedGroup(child.id, nextGroup)}
                                    onRemove={() => removeChild(child.id)}
                            />
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    {/if}

    <div class="mt-3 flex flex-wrap gap-2">
        <button type="button" class="btn btn-ghost btn-xs gap-1" onclick={addCondition}>
            <Plus class="h-3.5 w-3.5" />
            Add condition
        </button>
        <button type="button" class="btn btn-ghost btn-xs gap-1" onclick={addGroup}>
            <FolderPlus class="h-3.5 w-3.5" />
            Add group
        </button>
    </div>
</div>
