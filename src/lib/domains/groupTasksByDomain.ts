import { UNASSIGNED_DOMAIN_ID, type DomainRecord } from '$lib/db/domains'
import type { TaskRecord } from '$lib/db/dataView'
import { sortTasksByRules } from '$lib/kanban/sortTasks'
import { DEFAULT_COLUMN_SORT } from '$lib/kanban/taskOrderFields'

export function sortDomainsForColumns(domains: DomainRecord[]): DomainRecord[] {
    return domains.slice().sort((left, right) => left.name.localeCompare(right.name))
}

export function groupTasksByDomain(
    domains: DomainRecord[],
    tasks: TaskRecord[],
): Map<string, TaskRecord[]> {
    const grouped = new Map<string, TaskRecord[]>()

    for (const entry of domains) {
        grouped.set(entry.id, [])
    }
    grouped.set(UNASSIGNED_DOMAIN_ID, [])

    for (const task of tasks) {
        const columnId =
            task.domain_id && grouped.has(task.domain_id)
                ? task.domain_id
                : UNASSIGNED_DOMAIN_ID

        grouped.get(columnId)?.push(task)
    }

    const result = new Map<string, TaskRecord[]>()
    for (const [domainId, domainTasks] of grouped.entries()) {
        result.set(domainId, sortTasksByRules(domainTasks, DEFAULT_COLUMN_SORT))
    }

    return result
}
