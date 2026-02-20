import {sql} from 'drizzle-orm'
import {type AnySQLiteColumn, sqliteTable, text} from 'drizzle-orm/sqlite-core'
import {v4 as uuid} from 'uuid'
import domain from "./domain";

const task = sqliteTable('task', {
    id: text()
        .primaryKey()
        .$defaultFn(() => uuid()),
    title: text('title').notNull(),
    description: text('description'),
    domain_id: text('domain_id').references(() => domain.id),
    parent_task_id: text('parent_task_id').references((): AnySQLiteColumn => task.id),
    created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    updated_at: text('updated_at')
        .default(sql`CURRENT_TIMESTAMP`)
        .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
})

export default task
