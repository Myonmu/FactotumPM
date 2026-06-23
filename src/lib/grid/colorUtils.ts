export function colorIntToHex(value: unknown): string | null {
    if (value === null || value === undefined || value === '') {
        return null
    }

    const numeric = typeof value === 'number' ? value : Number(value)
    if (Number.isNaN(numeric)) {
        return null
    }

    return `#${(numeric & 0xffffff).toString(16).padStart(6, '0')}`
}

export function colorHexToInt(value: string): number | null {
    const normalized = value.trim().replace(/^#/, '')
    if (!normalized) {
        return null
    }

    const parsed = Number.parseInt(normalized, 16)
    return Number.isNaN(parsed) ? null : parsed
}

const DEFAULT_DISPLAY_COLOR = 'oklch(var(--p))'

/** CSS color for a stored RGB int (exact hex, no theme tinting). */
export function mixDisplayColorInt(
    color: number | null | undefined,
    fallback = DEFAULT_DISPLAY_COLOR,
): string {
    if (color == null) return fallback
    return colorIntToHex(color) ?? fallback
}

export type DomainColorNode = {
    id: string
    color?: number | null
    icon?: string | null
    parent_domain_id?: string | null
}

function readColorInt(value: unknown): number | null {
    if (value == null || value === '') return null
    const numeric = typeof value === 'number' ? value : Number(value)
    return Number.isNaN(numeric) ? null : numeric
}

function readParentDomainId(value: unknown): string | null {
    if (value == null || value === '') return null
    return String(value)
}

function readIcon(value: unknown): string | null {
    if (value == null || value === '') return null
    return String(value)
}

/** Effective domain color: own color, else walk parent_domain_id chain. */
export function resolveDomainColor(
    domainId: string | null | undefined,
    domains: DomainColorNode[] = [],
): number | null {
    if (!domainId) return null

    const byId = new Map(domains.map((domain) => [domain.id, domain]))
    let currentId: string | null = domainId
    const visited = new Set<string>()

    while (currentId && !visited.has(currentId)) {
        visited.add(currentId)
        const domain = byId.get(currentId)
        if (!domain) break

        const color = readColorInt(domain.color)
        if (color != null) return color

        currentId = readParentDomainId(domain.parent_domain_id)
    }

    return null
}

/** Effective domain icon: own icon, else walk parent_domain_id chain. */
export function resolveDomainIcon(
    domainId: string | null | undefined,
    domains: DomainColorNode[] = [],
): string | null {
    if (!domainId) return null

    const byId = new Map(domains.map((domain) => [domain.id, domain]))
    let currentId: string | null = domainId
    const visited = new Set<string>()

    while (currentId && !visited.has(currentId)) {
        visited.add(currentId)
        const domain = byId.get(currentId)
        if (!domain) break

        const icon = readIcon(domain.icon)
        if (icon != null) return icon

        currentId = readParentDomainId(domain.parent_domain_id)
    }

    return null
}

/** Effective task color: explicit task.color, else inherited domain color. */
export function resolveTaskColor(
    task: { color?: number | null; domain_id?: string | null },
    domains?: DomainColorNode[],
): number | null {
    if (task.color != null) return task.color
    return resolveDomainColor(task.domain_id, domains)
}

/** Icon tint for a data-view row: row.color, or inherited parent domain color. */
export function resolveRowIconColor(
    row: Record<string, unknown>,
    tableName: string,
    rows: Record<string, unknown>[] = [],
): number | null {
    const explicit = readColorInt(row.color)
    if (explicit != null) return explicit

    if (tableName !== 'domain') return null

    const domains: DomainColorNode[] = rows.map((entry) => ({
        id: String(entry.id),
        color: readColorInt(entry.color),
        parent_domain_id: readParentDomainId(entry.parent_domain_id),
    }))

    return resolveDomainColor(String(row.id), domains)
}
