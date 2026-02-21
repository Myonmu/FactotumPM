import { Store } from "@tauri-apps/plugin-store";

let storePromise: Promise<Store> | null = null;

async function getStore(): Promise<Store> {
    if (!storePromise) {
        storePromise = Store.load(".settings.dat");
    }
    return storePromise;
}

export async function getSavedTheme(): Promise<string | null> {
    const store = await getStore();
    return (await store.get<string>("theme")) ?? null;
}

export async function saveTheme(theme: string) {
    const store = await getStore();
    await store.set("theme", theme);
    await store.save();
}

export function applyTheme(theme: string) {
    document.documentElement.setAttribute("data-theme", theme);
}