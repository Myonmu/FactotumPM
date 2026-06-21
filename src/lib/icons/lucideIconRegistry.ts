import { icons } from 'lucide-svelte'
import type { Component } from 'svelte'

export type LucideIconComponent = Component<{ size?: number; class?: string }>

export type LucideIconEntry = {
    id: string
    label: string
    component: LucideIconComponent
}

function pascalToKebab(name: string): string {
    return name
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
        .toLowerCase()
}

function kebabToLabel(id: string): string {
    return id
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
}

export const SUGGESTED_ICON_IDS = [
    'smile',
    'smile-plus',
    'frown',
    'meh',
    'laugh',
    'heart',
    'heart-crack',
    'heart-pulse',
    'star',
    'thumbs-up',
    'thumbs-down',
    'trophy',
    'medal',
    'sparkles',
    'flame',
    'zap',
    'brain',
    'battery-full',
    'battery-low',
    'coffee',
    'moon',
    'sun',
    'cloud',
    'cloud-rain',
    'check',
    'circle-check',
    'x',
    'circle-x',
    'party-popper',
    'target',
    'crown',
    'skull',
    'shield',
    'rocket',
    'lightbulb',
    'alarm-clock',
    'hourglass',
    'flag',
    'puzzle',
] as const

export const lucideIconRegistry: LucideIconEntry[] = Object.entries(icons)
    .map(([exportName, component]) => {
        const id = pascalToKebab(exportName)
        return {
            id,
            label: kebabToLabel(id),
            component: component as unknown as LucideIconComponent,
        }
    })
    .sort((left, right) => left.id.localeCompare(right.id))

const iconById = new Map(lucideIconRegistry.map((entry) => [entry.id, entry.component]))

export function resolveLucideIcon(name: string | null | undefined): LucideIconComponent | null {
    if (!name) return null

    const normalized = name.trim().toLowerCase()
    if (!normalized) return null

    return iconById.get(normalized) ?? null
}

export function isKnownLucideIcon(name: string | null | undefined): boolean {
    return resolveLucideIcon(name) != null
}
