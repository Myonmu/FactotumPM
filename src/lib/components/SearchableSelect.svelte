<script lang="ts" context="module">
    const activeCloseByGroup = new Map<string, () => void>();
</script>

<script lang="ts">
    import Fuse from 'fuse.js';
    import { tick } from 'svelte';

    interface Item {
        id: string;
        title: string;
    }

    interface Props {
        label: string;
        items: Item[];
        value: string;
        placeholder?: string;
        group?: string;
        onSelect?: (id: string) => void;
    }

    let {
        label,
        items = [],
        value = $bindable(),
        placeholder = '',
        group = 'default',
        onSelect,
    }: Props = $props();

    function closeOthersInGroup() {
        const activeClose = activeCloseByGroup.get(group);
        if (activeClose && activeClose !== closeDropdown) {
            activeClose();
        }
        activeCloseByGroup.set(group, closeDropdown);
    }

    function clearFromGroup() {
        if (activeCloseByGroup.get(group) === closeDropdown) {
            activeCloseByGroup.delete(group);
        }
    }

    let query = $state('');
    let open = $state(false);

    let scrollTop = $state(0);
    let highlightedIndex = $state(0);

    const ITEM_HEIGHT = 30;
    const VIEWPORT_LIST_HEIGHT = 150;
    const SEARCH_HEIGHT = 36;

    let viewportHeight = $state(VIEWPORT_LIST_HEIGHT);

    let dropdownDirection = $state<'down' | 'up'>('down');

    let triggerRef: HTMLElement;

    let fuse = new Fuse(items, {
        keys: ['title'],
        threshold: 0.35
    });

    let filtered = $derived(
        query.trim().length === 0
            ? items
            : fuse.search(query).map(r => r.item)
    );

    let visibleCount = $derived(
        Math.ceil(viewportHeight / ITEM_HEIGHT) + 2
    );

    interface VirtualItem extends Item {
        __offset: number;
    }

    let visibleItems: VirtualItem[] = $derived(
        (() => {
            let start = Math.max(
                0,
                Math.floor(scrollTop / ITEM_HEIGHT)
            );

            return filtered
                .slice(start, start + visibleCount)
                .map((item, idx): VirtualItem => ({
                    ...item,
                    __offset: (start + idx) * ITEM_HEIGHT
                }));
        })()
    );

    function toggleDropdown() {
        if (open) closeDropdown();
        else openDropdown();
    }

    function closeDropdown() {
        open = false;
        clearFromGroup();
    }

    async function openDropdown() {
        closeOthersInGroup();
        open = true;
        await tick();
        calculateDropdownPosition();
    }

    $effect(() => {
        return () => {
            clearFromGroup();
        };
    });

    function selectItem(id: string) {
        value = id;
        onSelect?.(id);
        closeDropdown();
    }

    function onScroll(e: Event) {
        scrollTop = (e.target as HTMLElement).scrollTop;
    }

    function calculateDropdownPosition() {
        if (!triggerRef) return;

        const rect = triggerRef.getBoundingClientRect();

        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        const requiredHeight = VIEWPORT_LIST_HEIGHT + SEARCH_HEIGHT;

        if (spaceBelow >= requiredHeight || spaceBelow >= spaceAbove) {
            dropdownDirection = 'down';
        } else {
            dropdownDirection = 'up';
        }

        viewportHeight = Math.min(
            VIEWPORT_LIST_HEIGHT,
            dropdownDirection === 'down' ? spaceBelow - SEARCH_HEIGHT : spaceAbove - SEARCH_HEIGHT
        );

        if (viewportHeight < 90) viewportHeight = 90;
    }

    function onKeydown(e: KeyboardEvent) {
        if (!open) return;

        if (e.key === 'Escape') {
            closeDropdown();
            return;
        }

        if (e.key === 'ArrowDown') {
            highlightedIndex = Math.min(
                highlightedIndex + 1,
                filtered.length - 1
            );
            e.preventDefault();
            return;
        }

        if (e.key === 'ArrowUp') {
            highlightedIndex = Math.max(
                highlightedIndex - 1,
                0
            );
            e.preventDefault();
            return;
        }

        if (e.key === 'Enter') {
            let item = filtered[highlightedIndex];
            if (item) selectItem(item.id);
        }
    }

    function updateFuse() {
        fuse = new Fuse(items, {
            keys: ['title'],
            threshold: 0.35
        });
    }

    $effect(() => {
        updateFuse();
    });

    function measureViewport(node: HTMLElement) {
        viewportHeight = node.clientHeight;

        const resizeObserver = new ResizeObserver(() => {
            viewportHeight = node.clientHeight;
        });

        resizeObserver.observe(node);

        return {
            destroy() {
                resizeObserver.disconnect();
            }
        };
    }
</script>

<div class="relative space-y-1" onkeydown={onKeydown} tabindex="-1">

    {#if label}
        <label class="text-sm font-medium">{label}</label>
    {/if}

    <button
            bind:this={triggerRef}
            class="btn select select-bordered w-full"
            onclick={toggleDropdown}
    >
        {items.find(i => i.id === value)?.title || placeholder || 'None'}
    </button>

    {#if open}
        <div
                class="absolute z-50 mt-1 w-full rounded-lg border border-base-300 bg-base-100 shadow-lg flex flex-col"
                style="
                {dropdownDirection === 'up' ? 'bottom: 100%;' : 'top: 100%;'}
            "
        >

            <!-- Sticky Search -->
            <div
                    class="p-2"
                    class:sticky={true}
                    class:top-0={dropdownDirection === 'down'}
                    class:bottom-0={dropdownDirection === 'up'}
            >
                <input
                        class="input input-bordered w-full input-sm bg-base-300"
                        bind:value={query}
                        placeholder="Search..."
                />
            </div>

            <!-- Virtualized List -->
            <div
                    use:measureViewport
                    style="height: {viewportHeight}px; overflow-y: auto;"
                    onscroll={onScroll}
            >
                <div
                        style="
                        height: {filtered.length * ITEM_HEIGHT}px;
                        position: relative;
                    "
                >
                    {#each visibleItems as item, idx}
                        <div
                                class="flex items-center px-3 cursor-pointer hover:bg-base-200"
                                class:bg-base-300={highlightedIndex === idx}
                                style="
                                position: absolute;
                                top: {item.__offset}px;
                                height: {ITEM_HEIGHT}px;
                                line-height: {ITEM_HEIGHT}px;
                                width: 100%;
                            "
                                onclick={() => selectItem(item.id)}
                                onmouseenter={() => highlightedIndex = idx}
                        >
                            {item.title}
                        </div>
                    {/each}
                </div>
            </div>

        </div>
    {/if}

</div>