const SQL_FENCE_PATTERN = /```(?:sql)?\s*([\s\S]*?)```/gi

export function looksLikeSelectSql(text: string): boolean {
    const trimmed = text.trim().replace(/;\s*$/, '')
    if (!trimmed) return false
    return /^(WITH|SELECT)\b/i.test(trimmed)
}

export function extractSqlFromViewBody(body: string): string | null {
    const trimmed = body.trim()
    if (!trimmed) return null

    if (looksLikeSelectSql(trimmed)) {
        return trimmed.replace(/;\s*$/, '')
    }

    for (const match of trimmed.matchAll(SQL_FENCE_PATTERN)) {
        const candidate = match[1]?.trim() ?? ''
        if (looksLikeSelectSql(candidate)) {
            return candidate.replace(/;\s*$/, '')
        }
    }

    const selectMatch = trimmed.match(/\b(WITH|SELECT)\b[\s\S]*/i)
    if (selectMatch) {
        let sql = selectMatch[0].trim()
        const fenceIndex = sql.indexOf('```')
        if (fenceIndex >= 0) {
            sql = sql.slice(0, fenceIndex).trim()
        }
        if (looksLikeSelectSql(sql)) {
            return sql.replace(/;\s*$/, '')
        }
    }

    return null
}

function splitMarkdownRow(line: string): string[] {
    return line
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim())
}

export function parseMarkdownTable(body: string): {
    columns: string[]
    records: Record<string, unknown>[]
} | null {
    const lines = body
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('|'))

    if (lines.length < 2) return null

    const headerCells = splitMarkdownRow(lines[0])
    const divider = lines[1]
    if (!divider.includes('-')) return null

    const columns = headerCells.filter(Boolean)
    if (columns.length === 0) return null

    const records: Record<string, unknown>[] = []
    for (const line of lines.slice(2)) {
        const cells = splitMarkdownRow(line)
        if (cells.every((cell) => !cell)) continue

        const record: Record<string, unknown> = {}
        columns.forEach((column, index) => {
            record[column] = cells[index] ?? null
        })
        records.push(record)
    }

    return records.length > 0 ? { columns, records } : null
}

export function parseJsonRecords(body: string): {
    columns: string[]
    records: Record<string, unknown>[]
} | null {
    const trimmed = body.trim()
    if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return null

    try {
        const parsed = JSON.parse(trimmed) as unknown
        const rows = Array.isArray(parsed) ? parsed : [parsed]
        const records = rows.filter(
            (row): row is Record<string, unknown> =>
                row != null && typeof row === 'object' && !Array.isArray(row),
        )

        if (records.length === 0) return null

        const columns = [...new Set(records.flatMap((record) => Object.keys(record)))]
        return { columns, records }
    } catch {
        return null
    }
}

export type ParsedViewBody =
    | { kind: 'sql'; sql: string }
    | { kind: 'inline'; columns: string[]; records: Record<string, unknown>[]; warning: string }
    | { kind: 'invalid'; error: string; raw: string }

export function parseViewBody(body: string): ParsedViewBody {
    const sql = extractSqlFromViewBody(body)
    if (sql) {
        return { kind: 'sql', sql }
    }

    const json = parseJsonRecords(body)
    if (json) {
        return {
            kind: 'inline',
            ...json,
            warning:
                'View contained JSON data instead of SQL. Use a SELECT query inside <factotum-view> so the app fetches fresh data.',
        }
    }

    const markdown = parseMarkdownTable(body)
    if (markdown) {
        return {
            kind: 'inline',
            ...markdown,
            warning:
                'View contained a markdown table instead of SQL. Put only a SELECT query inside <factotum-view>, not pasted rows.',
        }
    }

    return {
        kind: 'invalid',
        error: 'View block must contain a single SELECT query (optionally wrapped in ```sql fences), not narrative text or result tables.',
        raw: body.trim(),
    }
}
