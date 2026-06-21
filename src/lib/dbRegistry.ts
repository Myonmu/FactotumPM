import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { getPrefJson, savePrefJson } from "$lib/prefStore";

const REGISTRY_KEY = "dbRegistry";

export type DbEntry = {
    id: string;
    name: string;
    relativePath: string;
    absolutePath: string;
    isDefault?: boolean;
    isPendingCreate?: boolean;
};

export type DbRegistry = {
    entries: DbEntry[];
    lastAccessedId: string | null;
};

export type ResolvedDbEntry = DbEntry & {
    resolvedPath: string;
    isValid: boolean;
};

type ResolvedDbPath = {
    resolved_path: string;
    exists: boolean;
};

type RegisteredDbPath = {
    name: string;
    relative_path: string;
    absolute_path: string;
};

function createId(): string {
    return crypto.randomUUID();
}

function normalizePath(path: string): string {
    return path.replace(/\\/g, "/").toLowerCase();
}

function matchesDbPath(
    entry: DbEntry,
    absolutePath: string,
    relativePath: string,
): boolean {
    return (
        normalizePath(entry.absolutePath) === normalizePath(absolutePath) ||
        (!!relativePath && entry.relativePath === relativePath)
    );
}

async function createDefaultDbEntry(
    registered: RegisteredDbPath,
): Promise<DbEntry> {
    return {
        id: createId(),
        name: "Default",
        relativePath: registered.relative_path,
        absolutePath: registered.absolute_path,
        isDefault: true,
    };
}

async function ensureDefaultDbEntry(registry: DbRegistry): Promise<DbRegistry> {
    const defaultDbPath = await invoke<string>("get_default_db_path");
    const registered = await invoke<RegisteredDbPath>("register_db_path", {
        absolutePath: defaultDbPath,
    });

    const hasDefault = registry.entries.some(
        (entry) =>
            entry.isDefault ||
            matchesDbPath(
                entry,
                registered.absolute_path,
                registered.relative_path,
            ),
    );

    if (hasDefault) {
        return {
            ...registry,
            entries: registry.entries.map((entry) =>
                entry.isDefault ||
                matchesDbPath(
                    entry,
                    registered.absolute_path,
                    registered.relative_path,
                )
                    ? { ...entry, isDefault: true, name: "Default" }
                    : entry,
            ),
        };
    }

    const defaultEntry = await createDefaultDbEntry(registered);
    return {
        entries: [defaultEntry, ...registry.entries],
        lastAccessedId: registry.lastAccessedId ?? defaultEntry.id,
    };
}

export async function loadDbRegistry(): Promise<DbRegistry> {
    const stored = await getPrefJson<DbRegistry>(REGISTRY_KEY);
    const registry: DbRegistry = stored?.entries
        ? stored
        : { entries: [], lastAccessedId: null };

    const updated = await ensureDefaultDbEntry(registry);
    await saveDbRegistry(updated);
    return updated;
}

export async function saveDbRegistry(registry: DbRegistry): Promise<void> {
    await savePrefJson(REGISTRY_KEY, registry);
}

export async function resolveDbEntry(entry: DbEntry): Promise<ResolvedDbEntry> {
    const resolved = await invoke<ResolvedDbPath>("resolve_db_path", {
        relativePath: entry.relativePath,
        absolutePath: entry.absolutePath,
    });

    return {
        ...entry,
        resolvedPath: resolved.resolved_path,
        isValid: resolved.exists,
    };
}

export async function resolveAllDbEntries(
    registry: DbRegistry,
): Promise<ResolvedDbEntry[]> {
    return Promise.all(registry.entries.map(resolveDbEntry));
}

export async function setActiveDbEntry(entry: ResolvedDbEntry): Promise<void> {
    const dbPath = entry.isValid ? entry.resolvedPath : entry.absolutePath;
    await invoke("set_active_db_path", { dbPath });
}

export async function registerDbPath(absolutePath: string): Promise<DbEntry> {
    const registered = await invoke<RegisteredDbPath>("register_db_path", {
        absolutePath,
    });

    return {
        id: createId(),
        name: registered.name,
        relativePath: registered.relative_path,
        absolutePath: registered.absolute_path,
    };
}

export async function addDbEntry(entry: DbEntry): Promise<DbRegistry> {
    const registry = await loadDbRegistry();
    const exists = registry.entries.some(
        (existing) =>
            existing.absolutePath === entry.absolutePath ||
            (entry.relativePath &&
                existing.relativePath === entry.relativePath),
    );

    if (!exists) {
        registry.entries = [...registry.entries, entry];
    }

    await saveDbRegistry(registry);
    return registry;
}

export async function removeDbEntry(entryId: string): Promise<DbRegistry> {
    const registry = await loadDbRegistry();
    const entry = registry.entries.find((item) => item.id === entryId);
    if (!entry || entry.isDefault) {
        return registry;
    }

    registry.entries = registry.entries.filter((item) => item.id !== entryId);
    if (registry.lastAccessedId === entryId) {
        registry.lastAccessedId = registry.entries[0]?.id ?? null;
    }
    await saveDbRegistry(registry);
    return registry;
}

export async function updateDbEntryPath(
    entryId: string,
    absolutePath: string,
): Promise<DbRegistry> {
    const registered = await invoke<RegisteredDbPath>("register_db_path", {
        absolutePath,
    });
    const registry = await loadDbRegistry();
    registry.entries = registry.entries.map((entry) =>
        entry.id === entryId
            ? {
                  ...entry,
                  name: registered.name,
                  relativePath: registered.relative_path,
                  absolutePath: registered.absolute_path,
                  isPendingCreate: false,
              }
            : entry,
    );
    await saveDbRegistry(registry);
    return registry;
}

export async function markDbAccessed(entryId: string): Promise<void> {
    const registry = await loadDbRegistry();
    registry.lastAccessedId = entryId;
    await saveDbRegistry(registry);
}

export async function pickDbFile(): Promise<string | null> {
    const selected = await open({
        multiple: false,
        directory: false,
        filters: [{ name: "SQLite Database", extensions: ["db", "sqlite", "sqlite3"] }],
    });

    if (typeof selected === "string") {
        return selected;
    }

    return null;
}

export async function pickNewDbSavePath(): Promise<string | null> {
    const selected = await save({
        filters: [{ name: "SQLite Database", extensions: ["db", "sqlite", "sqlite3"] }],
        defaultPath: "FactotumPM.db",
    });

    if (typeof selected === "string") {
        return selected;
    }

    return null;
}

export function isCreateMode(entry: ResolvedDbEntry): boolean {
    return (
        !!entry.isPendingCreate || !!(entry.isDefault && !entry.isValid)
    );
}

export function isStaleEntry(entry: ResolvedDbEntry): boolean {
    return !entry.isValid && !isCreateMode(entry);
}

export async function clearPendingCreate(entryId: string): Promise<void> {
    const registry = await loadDbRegistry();
    registry.entries = registry.entries.map((entry) =>
        entry.id === entryId ? { ...entry, isPendingCreate: false } : entry,
    );
    await saveDbRegistry(registry);
}

export function pickDefaultEntry(
    entries: ResolvedDbEntry[],
    lastAccessedId: string | null,
): ResolvedDbEntry | null {
    if (!entries.length) {
        return null;
    }

    if (lastAccessedId) {
        const lastAccessed = entries.find((entry) => entry.id === lastAccessedId);
        if (lastAccessed) {
            return lastAccessed;
        }
    }

    return entries.find((entry) => entry.isValid) ?? entries[0];
}
