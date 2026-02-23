<script lang="ts">
    import {goto} from "$app/navigation";

    let {folded} = $props();

    import {Candy, SquareKanban, Database, CalendarDays, Route, Trophy} from "lucide-svelte";
    import {isLoading} from "$lib/globalState.svelte";

    const tabs = [
        {id: "dashboard", label: "Dashboard", href: "/dashboard", icon: Candy},
        {id: "kanban", label: "Kanban", href: "/kanban", icon: SquareKanban},
        {id: "calendar", label: "Calendar", href: "/calendar", icon: CalendarDays},
        {id: "route", label: "Route", href: "/route", icon: Route},
        {id: "trophy", label: "Trophy", href: "/trophy", icon: Trophy},
        {id: "dataview", label: "Data View", href: "/dataview", icon: Database},
    ];

    let widthClass = $derived(
        folded ? "w-0" : "w-16"
    );

    let activeTab = $state(tabs[0]?.id);

    async function changeTab(id: string, href: string){
        activeTab = id;
        await goto(href);
    }
</script>

<aside
        class={`fixed left-0 top-30.5rem h-screen ${widthClass} hover:w-48 group
           bg-base-100 border-r border-base-300
           transition-all duration-300 ease-in-out
           flex flex-col z-40 overflow-hidden`}
>
    <nav class="p-2 gap-1 w-full">

        {#each tabs as {id, href, label, icon: Icon} (id)}
            <button
                    class="flex items-center rounded-btn p-3 hover:bg-base-200 transition-colors w-full my-2"
                    class:bg-base-300={activeTab === id}
                    onclick={() => changeTab(id, href)}
            >
                <Icon class="w-6 h-6 shrink-0"/>

                <span
                        class="whitespace-nowrap overflow-hidden transition-all duration-300 font-semibold ml-3
                           opacity-0 group-hover:opacity-100"
                >
                    {label}
                </span>
            </button>
        {/each}

    </nav>
</aside>