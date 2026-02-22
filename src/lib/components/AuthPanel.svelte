<script lang="ts">

    import {onMount} from "svelte";

    let actionType = $state<"init" | "auth">("init");
    let password = $state("");
    let confirmPassword = $state("");
    let isError = $state(false);
    let message = $state("");

    import {authenticateDb, doesDbExist, resetDb} from "$lib/auth.svelte";
    import {goto} from "$app/navigation";
    import {isLoading, setLoading} from "$lib/globalState.svelte";

    // Runs once on component mount
    onMount(async () => {
            let exists = await doesDbExist();
            actionType = exists ? "auth" : "init";
        }
    );

    async function handleInitialize(event: SubmitEvent) {
        event.preventDefault();

        if (!password || password.length < 4) {
            isError = true;
            message = "Password must be at least 4 characters.";
            return;
        }

        if (password !== confirmPassword) {
            isError = true;
            message = "Passwords do not match.";
            return;
        }

        try {
            setLoading(true);
            await authenticateDb(password);
            isError = false;
            message = "Database initialized successfully.";
            await goto("/app");
        } catch (err) {
            isError = true;
            message = `Initialization error: ${String(err)}`;
        } finally {
            setLoading(false)
        }
    }

    async function handleAuthenticate(event: SubmitEvent) {
        event.preventDefault();

        if (!password) {
            isError = true;
            message = "Please enter your password.";
            return;
        }

        try {
            setLoading(true)
            await authenticateDb(password);
            isError = false;
            message = "Authentication successful.";
            await goto("/app");
        } catch (err) {
            isError = true;
            message = "Invalid password.";
        } finally {
            setLoading(false);
        }
    }

    async function handleResetDatabase(event: MouseEvent) {
        event.preventDefault();

        if (!confirm("Are you sure? This will delete all data.")) return;

        try {
            await resetDb();
            isError = false;
            message = "Database reset. Please initialize again.";
            actionType = "init";
            password = "";
            confirmPassword = "";
        } catch (err) {
            isError = true;
            message = `Failed to reset database: ${err}`;
        }
    }
</script>

<div class="card w-full max-w-md shadow-xl bg-base-100">
    <div class="card-body">
        <h2 class="text-2xl font-bold text-center">
            {actionType === "init"
                ? "Let's Start Fresh"
                : "Welcome Back"}
        </h2>

        {#if message}
            <div
                    class="alert"
                    class:alert-error={isError}
                    class:alert-success={!isError}
            >
                <span>{message}</span>
            </div>
        {/if}

        <form
                class="space-y-4"
                onsubmit={actionType === "init"
          ? handleInitialize
          : handleAuthenticate}
        >

            {#if actionType === "init"}
                <div class="form-control">
                    <label class="label" for="pw1">Create Password</label>
                    <input
                            id="pw1"
                            type="password"
                            value={password}
                            oninput={(e) => password = e.currentTarget.value}
                            class="input input-bordered w-full"
                            placeholder="Enter a strong password"
                    />
                </div>

                <div class="form-control">
                    <label class="label" for="pw2">Confirm Password</label>
                    <input
                            id="pw2"
                            type="password"
                            value={confirmPassword}
                            oninput={(e) => confirmPassword = e.currentTarget.value
              }
                            class="input input-bordered w-full"
                            placeholder="Re-enter your password"
                    />
                </div>
            {:else}
                <div class="form-control">
                    <label class="label" for="pw3">Database Password</label>
                    <input
                            id="pw3"
                            type="password"
                            value={password}
                            oninput={(e) => password = e.currentTarget.value}
                            class="input input-bordered w-full"
                            placeholder="Enter your encryption password"
                    />
                </div>
            {/if}

            <div class="form-control mt-6">
                <button
                        type="submit"
                        class="btn btn-primary w-full"
                        disabled = {isLoading()}
                >
                    {#if isLoading()}
                        <span class="loading loading-spinner"></span>
                    {/if}
                    {actionType === "init"
                        ? "Initialize Database"
                        : "Connect"}
                </button>
            </div>

            {#if actionType === "auth"}
                <div class="form-control mt-4 text-center">
                    <button
                            type="button"
                            onclick={handleResetDatabase}
                            class="link link-error text-sm"
                    >
                        Forgot password? Reset database.
                    </button>
                </div>
            {/if}
        </form>

        <div class="text-center mt-4">
            {#if actionType === "auth"}
                <p class="text-sm">
                    No database yet?
                    <button
                            type="button"
                            class="link link-primary"
                            onclick={() => {
                message = "";
                actionType = "init";
              }}
                    >
                        Initialize new database
                    </button>
                </p>
            {:else}
                <p class="text-sm">
                    Already have a database?
                    <button
                            type="button"
                            class="link link-primary"
                            onclick={() => {
                message = "";
                actionType = "auth";
              }}
                    >
                        Connect to existing database
                    </button>
                </p>
            {/if}
        </div>

    </div>
</div>