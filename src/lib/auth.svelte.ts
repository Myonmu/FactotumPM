import { invoke } from "@tauri-apps/api/core";
import { goto } from "$app/navigation";
import { clearDbInstance } from "$lib/db/index";
import { markDbAccessed } from "$lib/dbRegistry";
import { initProjectState, resetProjectState } from "$lib/projectState.svelte";

let authSuccess = $state(false);

export function isAuthSuccess() {
    return authSuccess;
}

export async function checkAuthSuccess() {
    authSuccess = await invoke<boolean>("did_auth_succeed");
}

export async function doesDbExist(): Promise<boolean> {
    return await invoke<boolean>("does_db_exist");
}

export async function authenticateDb(
    password: string,
    entryId?: string,
    dbPath?: string,
): Promise<void> {
    await invoke("init_db", {
        encryptionKey: password,
        dbPath: dbPath ?? null,
    });
    const ready = await invoke<boolean>("is_db_ready");
    if (!ready) {
        throw new Error("Invalid password.");
    }
    if (entryId) {
        await markDbAccessed(entryId);
    }
    await checkAuthSuccess();
    if (authSuccess) {
        await initProjectState();
    }
}

export async function resetDb(): Promise<void> {
    await invoke("reset_db", { purgeData: true });
}

export async function logoutDb(): Promise<void> {
    await invoke("logout_db");
    authSuccess = false;
    clearDbInstance();
    resetProjectState();
    await goto("/");
}
