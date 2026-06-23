import { sql } from 'drizzle-orm'
import { real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { v4 as uuid } from 'uuid'

const observation = sqliteTable('observation', {
    id: text().primaryKey().$defaultFn(() => uuid()),
    content: text('content').notNull(),
    confidence: real('confidence').notNull(),
    created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
})

export default observation
