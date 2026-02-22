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