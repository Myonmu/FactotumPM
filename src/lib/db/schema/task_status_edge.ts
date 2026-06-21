import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { v4 as uuid } from 'uuid'
import taskStatus from './task_status'

const taskStatusEdge = sqliteTable('task_status_edge', {
    id: text()
        .primaryKey()
        .$defaultFn(() => uuid()),
    from_status_id: text('from_status_id')
        .notNull()
        .references(() => taskStatus.id, { onDelete: 'cascade' }),
    to_status_id: text('to_status_id')
        .notNull()
        .references(() => taskStatus.id, { onDelete: 'cascade' }),
    action: text('action'),
    color: integer('color'),
})

export default taskStatusEdge
