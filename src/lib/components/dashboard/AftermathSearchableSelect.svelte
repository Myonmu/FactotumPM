<script lang="ts" module>
    const activeCloseByGroup = new Map<string, () => void>()
</script>

<script lang="ts">
    import Fuse from 'fuse.js'
    import { tick } from 'svelte'

    import LucideIcon from '$lib/components/LucideIcon.svelte'
    import type { AftermathOption } from '$lib/db/aftermath'

    let {
        label,
        options = [],
        value = $bindable(''),
        placeholder = 'Select aftermath',
        group = 'aftermath',
        onSelect,
    }: {
        label: string
        options?: AftermathOption[]
        value?: string
        placeholder?: string
        group?: string
        onSelect?: (id: string) => void
    } = $props()

    const ITEM_HEIGHT = 36
    const VIEWPORT_LIST_HEIGHT = 180
    const SEARCH_HEIGHT = 36

    function closeOthersInGroup() {
        const activeClose = activeCloseByGroup.get(group)
        if (activeClose && activeClose !== closeDropdown) {
            activeClose()
        }
        activeCloseByGroup.set(group, closeDropdown)
    }

    function clearFromGroup() {
        if (activeCloseByGroup.get(group) === closeDropdown) {
            activeCloseByGroup.delete(group)
        }
    }

    let query = $state('')
    let open = $state(false)
    let scrollTop = $state(0)
    let highlightedIndex = $state(0)
    let viewportHeight = $state(VIEWPORT_LIST_HEIGHT)
    let dropdownDirection = $state<'down' | 'up'>('down')
    let triggerRef = $state<HTMLElement | undefined>(undefined)

    let fuse = $derived(
        new Fuse(options, {
            keys: ['title', 'description'],
            threshold: 0.35,
        }),
    )

    const selectedOption = $derived(options.find((option) => option.id === value) ?? null)

    const filtered = $derived(
        query.trim().length === 0 ? options : fuse.search(query).map((result) => result.item),
    )

    const visibleCount = $derived(Math.ceil(viewportHeight / ITEM_HEIGHT) + 2)

    interface VirtualItem extends AftermathOption {
        __offset: number
    }

    const visibleItems: VirtualItem[] = $derived(
        (() => {
            const start = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT))

            return filtered
                .slice(start, start + visibleCount)
                .map((item, idx): VirtualItem => ({
                    ...item,
                    __offset: (start + idx) * ITEM_HEIGHT,
                }))
        })(),
    )

    function toggleDropdown() {
        if (open) closeDropdown()
        else void openDropdown()
    }

    function closeDropdown() {
        open = false
        clearFromGroup()
    }

    async function openDropdown() {
        closeOthersInGroup()
        open = true
        await tick()
        calculateDropdownPosition()
    }

    function selectItem(id: string) {
        value = id
        onSelect?.(id)
        closeDropdown()
    }

    function onScroll(event: Event) {
        scrollTop = (event.target as HTMLElement).scrollTop
    }

    function calculateDropdownPosition() {
        if (!triggerRef) return

        const rect = triggerRef.getBoundingClientRect()
        const spaceBelow = window.innerHeight - rect.bottom
        const spaceAbove = rect.top
        const requiredHeight = VIEWPORT_LIST_HEIGHT + SEARCH_HEIGHT

        dropdownDirection =
            spaceBelow >= requiredHeight || spaceBelow >= spaceAbove ? 'down' : 'up'

        viewportHeight = Math.min(
            VIEWPORT_LIST_HEIGHT,
            dropdownDirection === 'down' ? spaceBelow - SEARCH_HEIGHT : spaceAbove - SEARCH_HEIGHT,
        )

        if (viewportHeight < 90) viewportHeight = 90
    }

    function onKeydown(event: KeyboardEvent) {
        if (!open) return

        if (event.key === 'Escape') {
            closeDropdown()
            return
        }

        if (event.key === 'ArrowDown') {
            highlightedIndex = Math.min(highlightedIndex + 1, filtered.length - 1)
            event.preventDefault()
            return
        }

        if (event.key === 'ArrowUp') {
            highlightedIndex = Math.max(highlightedIndex - 1, 0)
            event.preventDefault()
            return
        }

        if (event.key === 'Enter' && filtered[highlightedIndex]) {
            selectItem(filtered[highlightedIndex].id)
            event.preventDefault()
        }
    }
</script>

<svelte:window onkeydown={onKeydown} />

<label class="form-control w-full">
    <span class="label-text mb-1">{label}</span>

    <div class="relative">
        <button
                type="button"
                class="select select-bordered flex h-auto min-h-12 w-full items-center gap-2 py-2 text-left"
                bind:this={triggerRef}
                onclick={toggleDropdown}
                aria-haspopup="listbox"
                aria-expanded={open}
        >
            {#if selectedOption}
                <LucideIcon name={selectedOption.icon} size={18} color={selectedOption.color} />
                <span class="min-w-0 flex-1 truncate">{selectedOption.title}</span>
                {#if selectedOption.score != null}
                    <span class="badge badge-sm badge-ghost shrink-0">{selectedOption.score}/5</span>
                {/if}
            {:else}
                <span class="text-base-content/50">{placeholder}</span>
            {/if}
        </button>

        {#if open}
            <div
                    class="absolute z-50 w-full rounded-box border border-base-300 bg-base-100 shadow-xl"
                    class:top-full={dropdownDirection === 'down'}
                    class:mt-1={dropdownDirection === 'down'}
                    class:bottom-full={dropdownDirection === 'up'}
                    class:mb-1={dropdownDirection === 'up'}
            >
                <input
                        type="search"
                        class="input input-sm input-bordered m-2 w-[calc(100%-1rem)]"
                        placeholder="Search aftermaths..."
                        bind:value={query}
                        oninput={() => {
                            scrollTop = 0
                            highlightedIndex = 0
                        }}
                />

                <div
                        class="overflow-y-auto"
                        style:height="{viewportHeight}px"
                        onscroll={onScroll}
                        role="listbox"
                >
                    <div style:height="{filtered.length * ITEM_HEIGHT}px" class="relative">
                        {#each visibleItems as item (item.id)}
                            <button
                                    type="button"
                                    class="absolute flex w-full items-center gap-2 px-3 text-left hover:bg-base-200"
                                    class:bg-base-200={item.id === value}
                                    style:top="{item.__offset}px"
                                    style:height="{ITEM_HEIGHT}px"
                                    onclick={() => selectItem(item.id)}
                                    role="option"
                                    aria-selected={item.id === value}
                            >
                                <LucideIcon name={item.icon} size={16} color={item.color} />
                                <span class="min-w-0 flex-1 truncate">{item.title}</span>
                                {#if item.score != null}
                                    <span class="badge badge-xs badge-ghost shrink-0">{item.score}/5</span>
                                {/if}
                            </button>
                        {/each}

                        {#if filtered.length === 0}
                            <div class="px-3 py-6 text-center text-sm text-base-content/60">
                                No aftermaths found.
                            </div>
                        {/if}
                    </div>
                </div>
            </div>
        {/if}
    </div>
</label>
