import {type AnySQLiteColumn, integer, sqliteTable, text} from 'drizzle-orm/sqlite-core'
import {v4 as uuid} from 'uuid'
import project from './project'

const domain = sqliteTable('domain', {
    id: text().primaryKey().$defaultFn(() => uuid()),
    parent_domain_id: text('parent_domain_id').references((): AnySQLiteColumn => domain.id),
    name: text('name').notNull(),
    description: text('description'),
    icon: text('icon'),
    color: integer('color'),
    project_id: text('project_id').references(() => project.id),
})

export default domain