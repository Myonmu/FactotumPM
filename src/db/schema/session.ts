import {sql} from 'drizzle-orm'
import {type AnySQLiteColumn, blob, integer, sqliteTable, text} from 'drizzle-orm/sqlite-core'
import {v4 as uuid} from 'uuid'
import task from "./task";
import aftermath from "./aftermath";

const session = sqliteTable('session', {
    id: text().primaryKey().$defaultFn(() => uuid()),
    started_at: text('started_at').default(sql`CURRENT_TIMESTAMP`),
    ended_at: text('ended_at').default(sql`CURRENT_TIMESTAMP`),
    task_id: text('task_id').references(()=>task.id),
    aftermath_id: text('aftermath_id').references(()=> aftermath.id)
})

export default session