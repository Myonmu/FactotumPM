export type ToastEntry = {
    id: string
    kind: 'session_started' | 'error'
    taskTitle?: string
    message?: string
}

let toasts = $state<ToastEntry[]>([])

const TOAST_DURATION_MS = 4500

function dismissToast(id: string) {
    toasts = toasts.filter((entry) => entry.id !== id)
}

export function getToasts(): ToastEntry[] {
    return toasts
}

export function showSessionStartedToast(taskTitle: string) {
    const id = crypto.randomUUID()
    toasts = [...toasts, { id, kind: 'session_started', taskTitle }]
    setTimeout(() => dismissToast(id), TOAST_DURATION_MS)
}

export function showErrorToast(message: string) {
    const id = crypto.randomUUID()
    toasts = [...toasts, { id, kind: 'error', message }]
    setTimeout(() => dismissToast(id), TOAST_DURATION_MS)
}
