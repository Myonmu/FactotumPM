import {sql} from 'drizzle-orm'
import {type AnySQLiteColumn, integer, sqliteTable, text} from 'drizzle-orm/sqlite-core'
import {v4 as uuid} from 'uuid'

const domain = sqliteTable('domain', {
    id: text().primaryKey().$defaultFn(() => uuid()),
    parent_domain_id: text('parent_domain_id').references((): AnySQLiteColumn => domain.id),
    name: text('name').notNull(),
    description: text('description'),
    icon: text('icon'), // Lucide icon id, e.g. "folder"
    color: integer('color')
})

export default domain