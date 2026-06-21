<script lang="ts">

    import { onMount } from 'svelte'

    import { ChevronLeft, ChevronRight } from 'lucide-svelte'



    import DashboardMainView from '$lib/components/dashboard/DashboardMainView.svelte'

    import SessionAftermathView from '$lib/components/dashboard/SessionAftermathView.svelte'

    import TaskSuggestionPanel from '$lib/components/llm/TaskSuggestionPanel.svelte'

    import {

        getDashboardNav,

        getDashboardView,

        navigateDashboardBack,

        navigateDashboardForward,

    } from '$lib/dashboard/dashboardNav.svelte'

    import { loadDashboardSessions, type SessionRecord } from '$lib/db/sessions'



    type DashboardTab = 'welcome' | 'agent'



    let sessions = $state<SessionRecord[]>([])

    let now = $state(new Date())

    let loading = $state(true)

    let error = $state<string | null>(null)

    let activeTab = $state<DashboardTab>('welcome')



    const dashboardView = $derived(getDashboardView())

    const dashboardNav = $derived(getDashboardNav())



    const aftermathSession = $derived.by(() => {

        if (dashboardView.kind !== 'aftermath') return null

        return sessions.find((entry) => entry.id === dashboardView.sessionId) ?? null

    })



    async function refreshSessions() {

        sessions = await loadDashboardSessions()

    }



    async function loadDashboard() {

        loading = true

        error = null



        try {

            await refreshSessions()

        } catch (err) {

            error = err instanceof Error ? err.message : 'Failed to load dashboard'

        } finally {

            loading = false

        }

    }



    onMount(() => {

        void loadDashboard()



        const clockTimer = window.setInterval(() => {

            now = new Date()

        }, 30_000)



        return () => {

            window.clearInterval(clockTimer)

        }

    })

</script>



<div class="flex h-full min-h-0 flex-col bg-base-200">

    <div class="sticky top-0 z-30 border-b border-base-300 bg-base-200/95 px-4 py-3 backdrop-blur">

        <div class="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4">

            <div>

                <h1 class="text-2xl font-bold">

                    {dashboardView.kind === 'aftermath' ? 'Session aftermath' : 'Dashboard'}

                </h1>

                <p class="mt-1 text-sm text-base-content/60">

                    {#if dashboardView.kind === 'aftermath'}

                        Reflect on the session and optionally update the linked tasks.

                    {:else if activeTab === 'agent'}

                        Ask the Factotum agent to explore your data and suggest next steps.

                    {:else}

                        Your sessions for today and what is happening right now.

                    {/if}

                </p>

            </div>



            {#if dashboardNav.canGoBack || dashboardNav.canGoForward}

                <div class="flex items-center gap-2">

                    <span class="mr-1 text-sm font-semibold uppercase tracking-wide text-base-content/60">

                        Navigate

                    </span>

                    <button

                            type="button"

                            class="btn btn-sm btn-ghost btn-square"

                            title="Back"

                            disabled={!dashboardNav.canGoBack}

                            onclick={() => navigateDashboardBack()}

                    >

                        <ChevronLeft class="h-4 w-4" />

                    </button>

                    <button

                            type="button"

                            class="btn btn-sm btn-ghost btn-square"

                            title="Forward"

                            disabled={!dashboardNav.canGoForward}

                            onclick={() => navigateDashboardForward()}

                    >

                        <ChevronRight class="h-4 w-4" />

                    </button>

                </div>

            {/if}

        </div>



        {#if dashboardView.kind !== 'aftermath'}

            <div class="mx-auto mt-3 max-w-4xl">

                <div role="tablist" class="tabs tabs-boxed w-fit">

                    <button

                            type="button"

                            role="tab"

                            class="tab"

                            class:tab-active={activeTab === 'welcome'}

                            aria-selected={activeTab === 'welcome'}

                            onclick={() => {

                                activeTab = 'welcome'

                            }}

                    >

                        Welcome

                    </button>

                    <button

                            type="button"

                            role="tab"

                            class="tab"

                            class:tab-active={activeTab === 'agent'}

                            aria-selected={activeTab === 'agent'}

                            onclick={() => {

                                activeTab = 'agent'

                            }}

                    >

                        Agent

                    </button>

                </div>

            </div>

        {/if}

    </div>



    <div class="mx-auto w-full max-w-4xl flex-1 overflow-y-auto p-6">

        {#if loading}

            <div class="flex min-h-48 flex-1 items-center justify-center">

                <span class="loading loading-spinner loading-lg text-primary"></span>

            </div>

        {:else if error}

            <div class="alert alert-error">

                <span>{error}</span>

            </div>

        {:else if dashboardView.kind === 'aftermath' && aftermathSession}

            <SessionAftermathView

                    session={aftermathSession}

                    onComplete={refreshSessions}

                    onSkip={refreshSessions}

            />

        {:else if dashboardView.kind === 'aftermath'}

            <div class="alert alert-warning">

                <span>The selected session could not be found.</span>

            </div>

        {:else if activeTab === 'agent'}

            <div class="w-full">

                <TaskSuggestionPanel />

            </div>

        {:else}

            <DashboardMainView {sessions} {now} onSessionsChange={refreshSessions} />

        {/if}

    </div>

</div>

