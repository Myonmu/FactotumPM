import { invoke } from "@tauri-apps/api/core";
import { authenticateDb, resetDb } from "$lib/auth.svelte";
import { setLoading } from "$lib/globalState.svelte";
import {
    addDbEntry,
    clearPendingCreate,
    isCreateMode,
    isStaleEntry,
    loadDbRegistry,
    pickNewDbSavePath,
    pickDbFile,
    pickDefaultEntry,
    registerDbPath,
    removeDbEntry,
    resolveAllDbEntries,
    saveDbRegistry,
    setActiveDbEntry,
    updateDbEntryPath,
    type DbRegistry,
    type ResolvedDbEntry,
} from "$lib/dbRegistry";

export type LoginActionType = "init" | "auth";

let actionType = $state<LoginActionType>("init");
let password = $state("");
let confirmPassword = $state("");
let isError = $state(false);
let message = $state("");
let registry = $state<DbRegistry | null>(null);
let dbEntries = $state<ResolvedDbEntry[]>([]);
let selectedEntryId = $state<string | null>(null);

export function getSelectedEntry(): ResolvedDbEntry | null {
    return dbEntries.find((entry) => entry.id === selectedEntryId) ?? null;
}

export function getActionType() {
    return actionType;
}

export function getPassword() {
    return password;
}

export function setPassword(value: string) {
    password = value;
}

export function getConfirmPassword() {
    return confirmPassword;
}

export function setConfirmPassword(value: string) {
    confirmPassword = value;
}

export function getMessage() {
    return message;
}

export function isLoginError() {
    return isError;
}

export function getDbEntries() {
    return dbEntries;
}

export function getSelectedEntryId() {
    return selectedEntryId;
}

export function setActionType(value: LoginActionType) {
    actionType = value;
}

export function clearLoginMessage() {
    message = "";
    isError = false;
}

async function activateEntry(entry: ResolvedDbEntry) {
    await setActiveDbEntry(entry);
    if (entry.isValid) {
        actionType = "auth";
    } else if (isCreateMode(entry)) {
        actionType = "init";
    } else {
        actionType = "auth";
    }
}

export async function refreshRegistry(preferredEntryId?: string) {
    registry = await loadDbRegistry();
    dbEntries = await resolveAllDbEntries(registry);
    const selected = preferredEntryId
        ? dbEntries.find((entry) => entry.id === preferredEntryId) ??
          pickDefaultEntry(dbEntries, registry.lastAccessedId)
        : pickDefaultEntry(dbEntries, registry.lastAccessedId);
    selectedEntryId = selected?.id ?? null;
    if (selected) {
        await activateEntry(selected);
    }
}

export async function initLoginSession() {
    try {
        setLoading(true);
        await refreshRegistry();
    } finally {
        setLoading(false);
    }
}

export async function selectDbEntry(entryId: string) {
    selectedEntryId = entryId;
    const entry = dbEntries.find((item) => item.id === entryId);
    if (!entry) {
        return;
    }

    await activateEntry(entry);
    isError = false;
    message = "";
    password = "";
    confirmPassword = "";
}

export async function importDb() {
    const selectedPath = await pickDbFile();
    if (!selectedPath) {
        return;
    }

    const newEntry = await registerDbPath(selectedPath);
    registry = await addDbEntry(newEntry);
    await refreshRegistry(newEntry.id);
    isError = false;
    message = "Database imported. Enter the password to connect.";
}

export async function createDb() {
    const dbPath = await pickNewDbSavePath();
    if (!dbPath) {
        return;
    }

    const newEntry = {
        ...(await registerDbPath(dbPath)),
        isPendingCreate: true,
    };
    registry = await addDbEntry(newEntry);
    await invoke("set_active_db_path", { dbPath });
    await refreshRegistry(newEntry.id);
    isError = false;
    message = "Choose a password to create the new database.";
    password = "";
    confirmPassword = "";
}

export async function findDb(entryId: string) {
    const selectedPath = await pickDbFile();
    if (!selectedPath) {
        return;
    }

    registry = await updateDbEntryPath(entryId, selectedPath);
    await refreshRegistry(entryId);
    isError = false;
    message = "Database location updated.";
}

export async function removeDb(entryId: string) {
    registry = await removeDbEntry(entryId);
    await refreshRegistry();
    isError = false;
    message = "Database link removed.";
}

export async function initializeDb(): Promise<boolean> {
    const entry = getSelectedEntry();
    if (!entry) {
        isError = true;
        message = "Select a database first.";
        return false;
    }

    if (isStaleEntry(entry)) {
        isError = true;
        message = "This database file is missing. Find it or delete the link.";
        return false;
    }

    if (!password || password.length < 4) {
        isError = true;
        message = "Password must be at least 4 characters.";
        return false;
    }

    if (password !== confirmPassword) {
        isError = true;
        message = "Passwords do not match.";
        return false;
    }

    try {
        setLoading(true);
        await authenticateDb(password, entry.id, entry.absolutePath);
        await clearPendingCreate(entry.id);
        isError = false;
        message = "Database initialized successfully.";
        return true;
    } catch (err) {
        isError = true;
        message = `Initialization error: ${String(err)}`;
        return false;
    } finally {
        setLoading(false);
    }
}

export async function authenticateLogin(): Promise<boolean> {
    const entry = getSelectedEntry();
    if (!entry || isStaleEntry(entry)) {
        isError = true;
        message = "Selected database file is missing or invalid.";
        return false;
    }

    if (!password) {
        isError = true;
        message = "Please enter your password.";
        return false;
    }

    try {
        setLoading(true);
        await authenticateDb(password, entry.id, entry.absolutePath);
        isError = false;
        message = "Authentication successful.";
        return true;
    } catch {
        isError = true;
        message = "Invalid password.";
        return false;
    } finally {
        setLoading(false);
    }
}

export async function resetDatabase() {
    if (!confirm("Are you sure? This will delete all data.")) {
        return;
    }

    try {
        await resetDb();
        isError = false;
        message = "Database reset. Please initialize again.";
        actionType = "init";
        password = "";
        confirmPassword = "";
        if (registry) {
            await saveDbRegistry(registry);
        }
        await refreshRegistry();
    } catch (err) {
        isError = true;
        message = `Failed to reset database: ${err}`;
    }
}

export { isCreateMode, isStaleEntry };
