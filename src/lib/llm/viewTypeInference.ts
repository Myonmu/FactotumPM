import type { FactotumViewType } from './types'

const FROM_TABLE_PATTERN =
    /\bFROM\s+(?:(?:\w+\.)?(?:`([^`]+)`|"([^"]+)"|(\w+)))/i

export function inferViewTypeFromSql(
    sql: string | null,
    declared: FactotumViewType,
): FactotumViewType {
    if (declared !== 'table' || !sql) {
        return declared
    }

    const match = sql.match(FROM_TABLE_PATTERN)
    const table = (match?.[1] ?? match?.[2] ?? match?.[3])?.toLowerCase()

    switch (table) {
        case 'task':
            return 'task'
        case 'session':
            return 'session'
        case 'domain':
            return 'domain'
        case 'aftermath':
            return 'aftermath'
        case 'task_status':
            return 'task_status'
        default:
            return 'table'
    }
}

export function effectiveViewType(view: {
    type: FactotumViewType
    sql: string | null
}): FactotumViewType {
    return inferViewTypeFromSql(view.sql, view.type)
}
