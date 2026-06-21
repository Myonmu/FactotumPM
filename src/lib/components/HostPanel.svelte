<script lang="ts">
    import { ChevronLeft, ChevronRight } from 'lucide-svelte'

    import { isKanbanDragging } from '$lib/kanban/kanbanDrag.svelte';
    import { isRouteGraphDragging } from '$lib/route/routeGraphDrag.svelte';
    import {
        getTaskInspectorNav,
        navigateTaskInspectorBack,
        navigateTaskInspectorForward,
    } from '$lib/taskInspectorNav.svelte';

    const {
        component,
        componentProps = {},
        title = "Panel",
        visible = true,
        onClose,
    } = $props<{
        component: any;
        componentProps?: Record<string, any>;
        title?: string;
        visible?: boolean;
        onClose?: () => void;
    }>();

    let docked = $state(true);

    const taskNav = $derived(getTaskInspectorNav())

    let position = $state({ x: 0, y: 0 });
    let size = $state({ width: 600, height: 400 });

    const MIN_WIDTH = 300;
    const MIN_HEIGHT = 200;

    // --------------------------------------------
    // Center ONLY when transitioning to floating
    // --------------------------------------------
    let wasDocked = true;

    $effect(() => {
        if (wasDocked && !docked) {
            position = {
                x: window.innerWidth / 2 - size.width / 2,
                y: window.innerHeight / 2 - size.height / 2
            };
        }
        wasDocked = docked;
    });

    function toggleDock() {
        docked = !docked;
    }

    // ============================================
    // FLOATING: MOVE
    // ============================================
    let dragging = false;
    let dragOffset = { x: 0, y: 0 };

    function startDrag(e: MouseEvent) {
        if (docked) return;

        dragging = true;
        dragOffset = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };

        window.addEventListener("mousemove", onDrag);
        window.addEventListener("mouseup", stopDrag);
    }

    function onDrag(e: MouseEvent) {
        if (!dragging) return;

        position = {
            x: e.clientX - dragOffset.x,
            y: e.clientY - dragOffset.y
        };
    }

    function stopDrag() {
        dragging = false;
        window.removeEventListener("mousemove", onDrag);
        window.removeEventListener("mouseup", stopDrag);
    }

    // ============================================
    // FLOATING: RESIZE (ANCHOR CORRECTLY)
    // ============================================
    let resizing = false;
    let resizeDir = "";
    let startMouse = { x: 0, y: 0 };
    let startSize = { width: 0, height: 0 };
    let startPos = { x: 0, y: 0 };

    function startResize(e: MouseEvent, direction: string) {
        if (docked) return;

        e.stopPropagation();
        resizing = true;
        resizeDir = direction;

        startMouse = { x: e.clientX, y: e.clientY };
        startSize = { ...size };
        startPos = { ...position };

        window.addEventListener("mousemove", onResize);
        window.addEventListener("mouseup", stopResize);
    }

    function onResize(e: MouseEvent) {
        if (!resizing) return;

        const dx = e.clientX - startMouse.x;
        const dy = e.clientY - startMouse.y;

        let newWidth = startSize.width;
        let newHeight = startSize.height;
        let newX = startPos.x;
        let newY = startPos.y;

        // RIGHT edge → only width grows
        if (resizeDir === "right")
            newWidth = Math.max(MIN_WIDTH, startSize.width + dx);

        // LEFT edge → move X + shrink width
        if (resizeDir === "left") {
            newWidth = Math.max(MIN_WIDTH, startSize.width - dx);
            newX = startPos.x + (startSize.width - newWidth);
        }

        // BOTTOM edge → only height grows
        if (resizeDir === "bottom")
            newHeight = Math.max(MIN_HEIGHT, startSize.height + dy);

        // TOP edge → move Y + shrink height
        if (resizeDir === "top") {
            newHeight = Math.max(MIN_HEIGHT, startSize.height - dy);
            newY = startPos.y + (startSize.height - newHeight);
        }

        // Corners
        if (resizeDir === "bottomright") {
            newWidth = Math.max(MIN_WIDTH, startSize.width + dx);
            newHeight = Math.max(MIN_HEIGHT, startSize.height + dy);
        }

        if (resizeDir === "bottomleft") {
            newWidth = Math.max(MIN_WIDTH, startSize.width - dx);
            newHeight = Math.max(MIN_HEIGHT, startSize.height + dy);
            newX = startPos.x + (startSize.width - newWidth);
        }

        if (resizeDir === "topright") {
            newWidth = Math.max(MIN_WIDTH, startSize.width + dx);
            newHeight = Math.max(MIN_HEIGHT, startSize.height - dy);
            newY = startPos.y + (startSize.height - newHeight);
        }

        if (resizeDir === "topleft") {
            newWidth = Math.max(MIN_WIDTH, startSize.width - dx);
            newHeight = Math.max(MIN_HEIGHT, startSize.height - dy);
            newX = startPos.x + (startSize.width - newWidth);
            newY = startPos.y + (startSize.height - newHeight);
        }

        size = { width: newWidth, height: newHeight };
        position = { x: newX, y: newY };
    }

    function stopResize() {
        resizing = false;
        window.removeEventListener("mousemove", onResize);
        window.removeEventListener("mouseup", stopResize);
    }

    // ============================================
    // DOCKED: LEFT RESIZE
    // ============================================
    let dockResizing = false;
    let dockStartMouseX = 0;
    let dockStartWidth = 0;

    function startDockResize(e: MouseEvent) {
        e.stopPropagation();
        dockResizing = true;
        dockStartMouseX = e.clientX;
        dockStartWidth = size.width;

        window.addEventListener("mousemove", onDockResize);
        window.addEventListener("mouseup", stopDockResize);
    }

    function onDockResize(e: MouseEvent) {
        if (!dockResizing) return;

        const dx = dockStartMouseX - e.clientX;
        const newWidth = Math.max(MIN_WIDTH, dockStartWidth + dx);

        size = { ...size, width: newWidth };
    }

    function stopDockResize() {
        dockResizing = false;
        window.removeEventListener("mousemove", onDockResize);
        window.removeEventListener("mouseup", stopDockResize);
    }
</script>

{#if visible}
    {#if docked}
        <!-- ================= DOCKED MODE ================= -->
        <div
                class="inspector-panel relative flex h-full shrink-0 flex-col self-stretch border-l border-base-300 bg-base-200"
                class:pointer-events-none={isKanbanDragging() || isRouteGraphDragging()}
                style="width:{size.width}px;"
        >
            <!-- Left resize handle -->
            <div
                    class="absolute left-0 top-0 h-full w-2 cursor-w-resize z-10"
                    onmousedown={startDockResize}
            />

            <div class="flex items-center justify-between gap-2 px-4 py-2 bg-base-300 select-none">
                <div class="flex min-w-0 items-center gap-2">
                    {#if taskNav.enabled}
                        <div class="join shrink-0" onmousedown={(event) => event.stopPropagation()}>
                            <button
                                    type="button"
                                    class="btn btn-xs btn-ghost join-item"
                                    title="Back"
                                    disabled={!taskNav.canGoBack}
                                    onclick={() => void navigateTaskInspectorBack()}
                            >
                                <ChevronLeft class="h-4 w-4" />
                            </button>
                            <button
                                    type="button"
                                    class="btn btn-xs btn-ghost join-item"
                                    title="Forward"
                                    disabled={!taskNav.canGoForward}
                                    onclick={() => void navigateTaskInspectorForward()}
                            >
                                <ChevronRight class="h-4 w-4" />
                            </button>
                        </div>
                    {/if}
                    <h2 class="truncate font-semibold">{title}</h2>
                </div>
                <div class="flex shrink-0 gap-2">
                    <button class="btn btn-xs btn-ghost" onclick={toggleDock}>
                        Undock
                    </button>
                    <button class="btn btn-xs btn-ghost" onclick={() => onClose?.()}>
                        ✕
                    </button>
                </div>
            </div>

            <div class="flex-1 overflow-auto p-4 @container">
                {#if component}
                    {@const InspectorContent = component}
                    <InspectorContent {...componentProps} />
                {/if}
            </div>
        </div>
    {:else}
        <!-- ================= FLOATING MODE ================= -->
        <div
                class="inspector-panel fixed z-50 shadow-2xl rounded-box bg-base-200 border border-base-300 flex flex-col"
                class:pointer-events-none={isKanbanDragging() || isRouteGraphDragging()}
                style="left:{position.x}px; top:{position.y}px; width:{size.width}px; height:{size.height}px;"
        >
            <!-- Header -->
            <div
                    class="sticky flex items-center justify-between gap-2 px-4 py-2 bg-base-300 rounded-t-box cursor-move select-none"
                    onmousedown={startDrag}
            >
                <div class="flex min-w-0 items-center gap-2">
                    {#if taskNav.enabled}
                        <div class="join shrink-0" onmousedown={(event) => event.stopPropagation()}>
                            <button
                                    type="button"
                                    class="btn btn-xs btn-ghost join-item"
                                    title="Back"
                                    disabled={!taskNav.canGoBack}
                                    onclick={() => void navigateTaskInspectorBack()}
                            >
                                <ChevronLeft class="h-4 w-4" />
                            </button>
                            <button
                                    type="button"
                                    class="btn btn-xs btn-ghost join-item"
                                    title="Forward"
                                    disabled={!taskNav.canGoForward}
                                    onclick={() => void navigateTaskInspectorForward()}
                            >
                                <ChevronRight class="h-4 w-4" />
                            </button>
                        </div>
                    {/if}
                    <h2 class="truncate font-semibold">{title}</h2>
                </div>
                <div class="flex shrink-0 gap-2">
                    <button class="btn btn-xs btn-ghost" onclick={toggleDock}>
                        Dock
                    </button>
                    <button class="btn btn-xs btn-ghost" onclick={() => onClose?.()}>
                        ✕
                    </button>
                </div>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-auto p-4 @container">
                {#if component}
                    {@const InspectorContent = component}
                    <InspectorContent {...componentProps} />
                {/if}
            </div>

            <!-- Edge Handles -->
            <div class="absolute top-0 left-0 w-2 h-full cursor-w-resize"
                 onmousedown={(e) => startResize(e, "left")} />
            <div class="absolute top-0 right-0 w-2 h-full cursor-e-resize"
                 onmousedown={(e) => startResize(e, "right")} />
            <div class="absolute bottom-0 left-0 h-2 w-full cursor-s-resize"
                 onmousedown={(e) => startResize(e, "bottom")} />
            <div class="absolute top-0 left-0 w-full h-2 cursor-n-resize"
                 onmousedown={(e) => startResize(e, "top")} />

            <!-- Corners -->
            <div class="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize"
                 onmousedown={(e) => startResize(e, "bottomright")} />
            <div class="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize"
                 onmousedown={(e) => startResize(e, "bottomleft")} />
            <div class="absolute top-0 right-0 w-3 h-3 cursor-ne-resize"
                 onmousedown={(e) => startResize(e, "topright")} />
            <div class="absolute top-0 left-0 w-3 h-3 cursor-nw-resize"
                 onmousedown={(e) => startResize(e, "topleft")} />
        </div>
    {/if}
{/if}