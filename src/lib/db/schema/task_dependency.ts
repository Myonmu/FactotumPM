import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { v4 as uuid } from 'uuid'
import task from './task'

const taskDependency = sqliteTable('task_dependency', {
    id: text()
        .primaryKey()
        .$defaultFn(() => uuid()),
    from_task_id: text('from_task_id')
        .notNull()
        .references(() => task.id, { onDelete: 'cascade' }),
    to_task_id: text('to_task_id')
        .notNull()
        .references(() => task.id, { onDelete: 'cascade' }),
})

export default taskDependency
