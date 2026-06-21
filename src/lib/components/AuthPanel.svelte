<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { isLoading } from "$lib/globalState.svelte";
    import {
        authenticateLogin,
        clearLoginMessage,
        getActionType,
        getConfirmPassword,
        getMessage,
        getPassword,
        initLoginSession,
        initializeDb,
        isCreateMode,
        isLoginError,
        isStaleEntry,
        resetDatabase,
        getSelectedEntry,
        setActionType,
        setConfirmPassword,
        setPassword,
    } from "$lib/loginSession.svelte";
    import { Database } from "lucide-svelte";

    let { landingPage } = $props();

    const selectedEntry = $derived(getSelectedEntry());
    const actionType = $derived(getActionType());
    const password = $derived(getPassword());
    const confirmPassword = $derived(getConfirmPassword());
    const message = $derived(getMessage());
    const isError = $derived(isLoginError());

    onMount(async () => {
        await initLoginSession();
    });

    async function handleInitialize(event: SubmitEvent) {
        event.preventDefault();
        if (await initializeDb()) {
            await goto(landingPage);
        }
    }

    async function handleAuthenticate(event: SubmitEvent) {
        event.preventDefault();
        if (await authenticateLogin()) {
            await goto(landingPage);
        }
    }
</script>

<div class="card w-full max-w-md shadow-xl bg-base-100">
    <div class="card-body gap-5">
        <div class="text-center">
            <h2 class="text-2xl font-bold">
                {#if selectedEntry && isStaleEntry(selectedEntry)}
                    Database Not Found
                {:else if actionType === "init"}
                    Let's Start Fresh
                {:else}
                    Welcome Back
                {/if}
            </h2>
        </div>

        {#if selectedEntry}
            <div
                class="flex items-center gap-3 rounded-box border border-base-300 bg-base-200/50 px-3 py-2"
            >
                <div
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                >
                    <Database class="h-5 w-5" />
                </div>
                <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium">
                        {selectedEntry.name}
                    </p>
                    <p class="truncate text-xs text-base-content/60">
                        {selectedEntry.absolutePath}
                    </p>
                </div>
                {#if isStaleEntry(selectedEntry)}
                    <span class="badge badge-warning badge-sm">Missing</span>
                {:else if isCreateMode(selectedEntry)}
                    <span class="badge badge-info badge-sm">New</span>
                {:else}
                    <span class="badge badge-success badge-sm">Ready</span>
                {/if}
            </div>
        {/if}

        {#if message}
            <div
                class="alert"
                class:alert-error={isError}
                class:alert-success={!isError}
            >
                <span>{message}</span>
            </div>
        {/if}

        {#if selectedEntry && (selectedEntry.isValid || isCreateMode(selectedEntry))}
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
                            oninput={(e) => setPassword(e.currentTarget.value)}
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
                            oninput={(e) =>
                                setConfirmPassword(e.currentTarget.value)}
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
                            oninput={(e) => setPassword(e.currentTarget.value)}
                            class="input input-bordered w-full"
                            placeholder="Enter your encryption password"
                        />
                    </div>
                {/if}

                <div class="form-control">
                    <button
                        type="submit"
                        class="btn btn-primary w-full"
                        disabled={isLoading() ||
                            !selectedEntry ||
                            (actionType === "auth" && !selectedEntry.isValid)}
                    >
                        {#if isLoading()}
                            <span class="loading loading-spinner"></span>
                        {/if}
                        {actionType === "init"
                            ? "Create Database"
                            : "Connect"}
                    </button>
                </div>

                {#if actionType === "auth"}
                    <div class="text-center">
                        <button
                            type="button"
                            onclick={resetDatabase}
                            class="link link-error text-sm"
                        >
                            Forgot password? Reset database.
                        </button>
                    </div>
                {/if}
            </form>
        {:else if selectedEntry && isStaleEntry(selectedEntry)}
            <p class="text-center text-sm text-base-content/70">
                Use the database panel to find the file or remove this link.
            </p>
        {/if}

        {#if actionType === "init" && selectedEntry && (selectedEntry.isValid || isCreateMode(selectedEntry))}
            <div class="text-center">
                <p class="text-sm">
                    Already have a database?
                    <button
                        type="button"
                        class="link link-primary"
                        onclick={() => {
                            clearLoginMessage();
                            setActionType("auth");
                        }}
                    >
                        Connect to existing database
                    </button>
                </p>
            </div>
        {/if}
    </div>
</div>
