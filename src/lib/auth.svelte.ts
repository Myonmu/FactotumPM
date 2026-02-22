import {invoke} from "@tauri-apps/api/core";
let authSuccess = $state(false);
export function isAuthSuccess(){
    return authSuccess.valueOf();
}
export async function doesDbExist(): Promise<boolean> {
    return await invoke<boolean>("does_db_exist");
}

export async function authenticateDb(password: string): Promise<void> {
    await invoke("init_db", {encryptionKey: password});
    const ready = await invoke<boolean>("is_db_ready");
    if (!ready) {
        throw new Error("Invalid password.");
    }
    authSuccess = true;
}

export async function resetDb(): Promise<void> {
    await invoke("reset_db", {purgeData: true});
}