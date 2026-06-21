import { invoke } from '@tauri-apps/api/core'
import { drizzle } from 'drizzle-orm/sqlite-proxy'

import * as schema from './schema'

type Row = {
    columns: string[]
    rows: (string | number)[] // Drizzle uses any, but for our proxy we know the types
}

type Method = 'run' | 'all' | 'values' | 'get'

let dbInstance = null as ReturnType<typeof drizzle> | null

export function clearDbInstance() {
    dbInstance = null
}

export const getDb = async () => {
    if (dbInstance !== null) return dbInstance

    // Check if DB is ready before allowing usage
    try {
        const isReady = await invoke<boolean>('is_db_ready')

        if (!isReady) {
            console.warn("Database not yet initialized. Please call init_db first.")
            return null
        }

        await invoke('run_pending_migrations')

        dbInstance = drizzle(
            async (sql, params, method) => {
                const rows = await invoke<Row[]>('execute_single_sql', {
                    query: { sql, params },
                })

                return mapRows(rows, method)
            },
            async (
                queries: {
                    sql: string
                    params: any[]
                    method: Method
                }[],
            ) => {
                const batchRows = await invoke<Row[][]>('execute_batch_sql', {
                    queries,
                })

                return batchRows.map((rows, index) => {
                    const query = queries[index]
                    return mapRows(rows, query.method)
                })
            },
            {
                schema,
                logger: import.meta.env.DEV,
            }
        )

        return dbInstance
    } catch (err) {
        console.error("Failed to get DB instance:", err)
        return null
    }
}

function mapRows(rows: Row[], method: Method) {
    if (rows.length === 0 && method === 'get') {
        return {} as { rows: [] }
    }

    // Convert row values to appropriate types (string to number where needed)
    const processedRows = rows.map(row => ({
        columns: row.columns,
        rows: row.rows.map(value => {
            if (typeof value === "string") {
                // Try to parse numbers
                if (!isNaN(Number(value))) return Number(value)
            }
            return value
        })
    }))

    return {
        rows: method === 'get' ? processedRows[0].rows : processedRows.map(r => r.rows),
    }
}

export const checkDbStatus = async (): Promise<boolean> => {
    try {
        return await invoke<boolean>('is_db_ready')
    } catch (err) {
        console.error("Database status check failed:", err)
        return false
    }
}

export const initDbWithPassword = async (password: string): Promise<boolean> => {
    try {
        await invoke('init_db', { encryptionKey: password, dbPath: null })

        // Wait a moment for the database to fully initialize
        await new Promise(resolve => setTimeout(resolve, 100))

        return await checkDbStatus()
    } catch (err) {
        console.error("Database initialization failed:", err)
        return false
    }
}

export const db = drizzle(
    async (sql, params, method) => {
        const rows = await invoke<Row[]>('execute_single_sql', {
            query: { sql, params },
        })
        /**
         * Response type:
         * {rows: string[]} for 'get'
         * {rows: string[][]} for rest
         *
         * More info: https://orm.drizzle.team/docs/connect-drizzle-proxy
         */
        return mapRows(rows, method)
    },
    async (
        queries: {
            sql: string
            params: any[]
            method: Method
        }[],
    ) => {
        const batchRows = await invoke<Row[][]>('execute_batch_sql', {
            queries,
        })
        /**
         * Response type:
         * {rows: string[]}[] for 'get'
         * {rows: string[][]}[] for rest
         * More info: https://orm.drizzle.team/docs/connect-drizzle-proxy
         */
        return batchRows.map((rows, index) => {
            const query = queries[index]
            return mapRows(rows, query.method)
        })
    },
    {
        schema,
        logger: import.meta.env.DEV,
    },
)
