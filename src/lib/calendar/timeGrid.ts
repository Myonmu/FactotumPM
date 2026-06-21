export const HOUR_HEIGHT = 56
export const MINUTES_PER_DAY = 24 * 60
export const DAY_GRID_HEIGHT = 24 * HOUR_HEIGHT

export function minutesToPercent(minutes: number): number {
    return (minutes / MINUTES_PER_DAY) * 100
}

export function minutesToPixels(minutes: number): number {
    return (minutes / MINUTES_PER_DAY) * DAY_GRID_HEIGHT
}

export function percentToMinutes(percent: number): number {
    return (percent / 100) * MINUTES_PER_DAY
}
