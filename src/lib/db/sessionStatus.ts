export const SessionStatusCode = {
    Planned: 0,
    Started: 1,
    Finished: 2,
    NoLongerNeeded: 3,
} as const

export type SessionStatusCode = (typeof SessionStatusCode)[keyof typeof SessionStatusCode]

export const SESSION_STATUS_CODES: SessionStatusCode[] = [
    SessionStatusCode.Planned,
    SessionStatusCode.Started,
    SessionStatusCode.Finished,
    SessionStatusCode.NoLongerNeeded,
]

export type SessionStatusOption = {
    id: SessionStatusCode
    title: string
}

export const SESSION_STATUS_OPTIONS: SessionStatusOption[] = [
    { id: SessionStatusCode.Planned, title: 'Planned' },
    { id: SessionStatusCode.Started, title: 'Started' },
    { id: SessionStatusCode.Finished, title: 'Finished' },
    { id: SessionStatusCode.NoLongerNeeded, title: 'No longer needed' },
]

export function normalizeSessionStatus(value: unknown): SessionStatusCode {
    if (typeof value === 'number' && Number.isInteger(value)) {
        if (value >= 0 && value <= 3) return value as SessionStatusCode
    }

    if (typeof value === 'string') {
        const trimmed = value.trim()
        const numeric = Number(trimmed)
        if (!Number.isNaN(numeric) && Number.isInteger(numeric) && numeric >= 0 && numeric <= 3) {
            return numeric as SessionStatusCode
        }

        switch (trimmed) {
            case 'started':
                return SessionStatusCode.Started
            case 'finished':
                return SessionStatusCode.Finished
            case 'no_longer_needed':
            case 'no longer needed':
                return SessionStatusCode.NoLongerNeeded
        }
    }

    return SessionStatusCode.Planned
}

export function sessionStatusLabel(status: SessionStatusCode): string {
    return SESSION_STATUS_OPTIONS.find((option) => option.id === status)?.title ?? 'Planned'
}

export function isDashboardVisibleSessionStatus(status: SessionStatusCode): boolean {
    return status !== SessionStatusCode.NoLongerNeeded
}
