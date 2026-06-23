import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { v4 as uuid } from 'uuid'

const project = sqliteTable('project', {
    id: text().primaryKey().$defaultFn(() => uuid()),
    name: text('name').notNull(),
    description: text('description'),
    color: integer('color'),
    icon: text('icon'),
    created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
})

export default project
