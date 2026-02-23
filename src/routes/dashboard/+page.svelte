<script lang="ts">
    import { getDb } from "$lib/db";

    // Example: You can now use the DB connection to fetch data
    //$: console.log("Database is connected:", !!db);

    let tasks = $state([]);
    let domains = $state([]);

    async function loadInitialData() {
        try {
            const db = await getDb();
            if (db) {
                // Here you could start fetching data from your tables
                // For example: const allTasks = await db.query.tasks.findMany();
            }
        } catch (err) {
            console.error("Error loading data:", err);
        }
    }

    // Load data when component mounts
    $effect(() => {
        loadInitialData();
    });
</script>

<div class="h-full bg-base-200">

    <div class="p-6 max-w-7xl mx-auto">
        <h1 class="text-3xl font-bold mb-6">Dashboard</h1>

        {#if tasks.length > 0 || domains.length > 0}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Task List -->
                <div class="card bg-base-100 shadow-xl">
                    <div class="card-body">
                        <h2 class="card-title">Tasks</h2>
                        <p>Task count: {tasks.length}</p>
                        <div class="divider"></div>
                        <ul class="list-disc pl-5 space-y-2">
                            {#each tasks as task}
                                <li>{task.title || "Untitled Task"}</li>
                            {/each}
                        </ul>
                    </div>
                </div>

                <!-- Domains -->
                <div class="card bg-base-100 shadow-xl">
                    <div class="card-body">
                        <h2 class="card-title">Domains</h2>
                        <p>Domain count: {domains.length}</p>
                    </div>
                </div>
            </div>
        {:else}
            <div class="alert alert-info">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current flex-shrink-0 w-6 h-6">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <div>
                    <h3 class="font-bold">Welcome to FactotumPM Web!</h3>
                    <p>Your encrypted database is connected and ready.</p>
                </div>
            </div>
        {/if}
    </div>
</div>