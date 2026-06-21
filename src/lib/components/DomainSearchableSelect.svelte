<script lang="ts" context="module">
    const activeCloseByGroup = new Map<string, () => void>()
</script>

<script lang="ts">
    import Fuse from 'fuse.js'
    import { tick } from 'svelte'

    import DomainRefChip from '$lib/components/DomainRefChip.svelte'
    import type { DomainOption } from '$lib/db/dataView'
    import { mixDisplayColorInt, resolveDomainColor } from '$lib/grid/colorUtils'

    interface Props {
        label: string
        domains: DomainOption[]
        value: string
        placeholder?: string
        group?: string
        onSelect?: (id: string) => void
    }

    let {
        label,
        domains = [],
        value = $bindable(),
        placeholder = '',
        group = 'default',
        onSelect,
    }: Props = $props()

    const ITEM_HEIGHT = 32
    const VIEWPORT_LIST_HEIGHT = 150
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
    let triggerRef: HTMLElement

    let fuse = new Fuse(domains, {
        keys: ['title'],
        threshold: 0.35,
    })

    const selectedDomain = $derived(domains.find((domain) => domain.id === value) ?? null)

    const selectedBorderColor = $derived.by(() => {
        if (!selectedDomain) return null
        const color = resolveDomainColor(selectedDomain.id, domains)
        return color != null ? mixDisplayColorInt(color) : null
    })

    const filtered = $derived(
        query.trim().length === 0 ? domains : fuse.search(query).map((result) => result.item),
    )

    const visibleCount = $derived(Math.ceil(viewportHeight / ITEM_HEIGHT) + 2)

    interface VirtualItem extends DomainOption {
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

        if (event.key === 'Enter') {
            const item = filtered[highlightedIndex]
            if (item) selectItem(item.id)
        }
    }

    function updateFuse() {
        fuse = new Fuse(domains, {
            keys: ['title'],
            threshold: 0.35,
        })
    }

    function measureViewport(node: HTMLElement) {
        viewportHeight = node.clientHeight

        const resizeObserver = new ResizeObserver(() => {
            viewportHeight = node.clientHeight
        })

        resizeObserver.observe(node)

        return {
            destroy() {
                resizeObserver.disconnect()
            },
        }
    }

    $effect(() => {
        return () => {
            clearFromGroup()
        }
    })

    $effect(() => {
        updateFuse()
    })
</script>

<div class="relative space-y-1" onkeydown={onKeydown} tabindex="-1">
    {#if label}
        <label class="text-sm font-medium">{label}</label>
    {/if}

    <button
            bind:this={triggerRef}
            type="button"
            class="btn select select-bordered h-auto min-h-10 w-full px-3 py-2 text-left"
            style:border-color={selectedBorderColor ?? undefined}
            onclick={toggleDropdown}
    >
        {#if selectedDomain}
            <span class="truncate">{selectedDomain.title}</span>
        {:else}
            <span class="text-base-content/50">{placeholder || 'None'}</span>
        {/if}
    </button>

    {#if open}
        <div
                class="absolute z-50 mt-1 flex w-full flex-col rounded-lg border border-base-300 bg-base-100 shadow-lg"
                style={dropdownDirection === 'up' ? 'bottom: 100%;' : 'top: 100%;'}
        >
            <div
                    class="p-2"
                    class:sticky={true}
                    class:top-0={dropdownDirection === 'down'}
                    class:bottom-0={dropdownDirection === 'up'}
            >
                <input
                        class="input input-bordered input-sm w-full bg-base-300"
                        bind:value={query}
                        placeholder="Search..."
                />
            </div>

            <div
                    use:measureViewport
                    style="height: {viewportHeight}px; overflow-y: auto;"
                    onscroll={onScroll}
            >
                <div style="height: {filtered.length * ITEM_HEIGHT}px; position: relative;">
                    {#each visibleItems as item, idx (item.id)}
                        <div
                                class="cursor-pointer px-2 hover:bg-base-200"
                                class:bg-base-300={highlightedIndex === idx}
                                style="
                                    position: absolute;
                                    top: {item.__offset}px;
                                    height: {ITEM_HEIGHT}px;
                                    line-height: {ITEM_HEIGHT}px;
                                    width: 100%;
                                "
                                onclick={() => selectItem(item.id)}
                                onmouseenter={() => (highlightedIndex = idx)}
                        >
                            <DomainRefChip domain={item} {domains} class="h-full py-0.5" />
                        </div>
                    {/each}
                </div>
            </div>
        </div>
    {/if}
</div>
