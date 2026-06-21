import { Store } from "@tauri-apps/plugin-store";

let storePromise: Promise<Store> | null = null;

async function getStore(): Promise<Store> {
    if (!storePromise) {
        storePromise = Store.load(".settings.dat");
    }
    return storePromise;
}

export async function getPrefString(key: string): Promise<string | null> {
    const store = await getStore();
    return (await store.get<string>(key)) ?? null;
}

export async function savePrefString(key: string, value: string) {
    const store = await getStore();
    await store.set(key, value);
    await store.save();
}

export async function getPrefJson<T>(key: string): Promise<T | null> {
    const raw = await getPrefString(key);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

export async function savePrefJson<T>(key: string, value: T) {
    await savePrefString(key, JSON.stringify(value));
}