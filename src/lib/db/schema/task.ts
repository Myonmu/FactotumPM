import {sql} from 'drizzle-orm'
import {type AnySQLiteColumn, integer, real, sqliteTable, text} from 'drizzle-orm/sqlite-core'
import {v4 as uuid} from 'uuid'
import domain from "./domain";
import taskStatus from "./task_status";
import project from "./project";

/** Design Philosophy
 * Unlike most PM tools, our tool is focused on personal use for folks that have diverse capabilities (the opposite to teams)
 * Thus, we removed "who's responsible for the task" and split work-hour with
 *  - uncertainty: how unclear the method to process the task is.
 *  - complexity: the intellectual excitement the task brings/ the number of brain cells it could kill
 *  - effort: the amount of work needs to be done
 *  These metrics are used to suggest a task based on user mood report. Propose complex task when user feels energetic
 *  to tackle tough tasks, and trivial tasks when in lower energy.
 *  Low-complexity and high effort task is also a marker to remind the user that there is automation potential (e.g. batch-editing config files
 *  after schema change, this can be a large trivial task if done manually, but one could toss the task to an AI and produce a batch editing script
 *  that does the job in one click)
 *
 *  Domain is what usually represented by different departments. Here it is again used to suggest best task to do based on
 *  past activity and current mood. If the user wants to do art, then suggest something in art domain. If the user is unsure,
 *  we may check past records, if the user has been doing programming for long, we could prompt if the user want a change of mood
 *  and do writing/art instead.
 *
 *  We do not split milestones and legends, etc. Instead, any task can be marked as a trophy task - which is our concept of milestone.
 *  Trophy size is calculated based on its depth (the deeper the smaller), child task count, and accumulated complexity and effort.
 *  By default, a non-leaf task is a trophy.
 *
 *  We would suggest the best strategy to earn trophies so that it makes the user feel they are making progress.
 */

const task = sqliteTable('task', {
    id: text()
        .primaryKey()
        .$defaultFn(() => uuid()),
    title: text('title').notNull(),
    description: text('description'),
    detail: text('detail'),
    // the 3 following values, for now, we use a scale of 1 to 10.
    uncertainty: integer("uncertainty"), // high uncertainty makes complexity and effort less accurate.
    uncertainty_can_estimate: integer('uncertainty_can_estimate'), // null=unset, 0=cannot estimate, 1=has estimate
    // complexity and effort can be 0 for "super easy" / "no effort"; null value means unknown when can_estimate=0
    complexity: integer("complexity"), // how challenging the task is, or how interesting is the puzzle. read-only when a task has child tasks
    complexity_can_estimate: integer('complexity_can_estimate'),
    effort: integer("effort"), // the payload
    effort_can_estimate: integer('effort_can_estimate'),
    // which domain does this task belong to (art, writing, coding, etc)
    // use a searchable dropdown, and it should affect the rendering of the task card (change border color, for example)
    domain_id: text('domain_id').references(() => domain.id),
    // Optional explicit card color. When null, the task inherits its domain color at display time.
    color: integer('color'),
    // use a searchable dropdown
    parent_task_id: text('parent_task_id').references((): AnySQLiteColumn => task.id), // is this part of a bigger task
    is_trophy: integer('is_trophy', { mode: 'boolean' }).notNull().default(false),
    task_status_id: text('task_status_id').references(() => taskStatus.id),
    project_id: text('project_id').references(() => project.id),
    route_pos_x: real('route_pos_x'),
    route_pos_y: real('route_pos_y'),
    route_pos_manual: integer('route_pos_manual', { mode: 'boolean' }).notNull().default(false),
    created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    updated_at: text('updated_at')
        .default(sql`CURRENT_TIMESTAMP`)
        .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
})

const task_columns= [
    {id: "id", hidden: true},
    {id: "title", header: "Title"},
    {id: "description", header: "Description"},
    {id: "detail", header: "Detail", hidden: true},
    {id: "uncertainty", header: "Uncertainty"},
    {id: "uncertainty_can_estimate", header: "Uncertainty Can Estimate", hidden: true},
    {id: "complexity", header: "Complexity"},
    {id: "complexity_can_estimate", header: "Complexity Can Estimate", hidden: true},
    {id: "effort", header: "Effort"},
    {id: "effort_can_estimate", header: "Effort Can Estimate", hidden: true},
    {id: "domain_id", header: "Domain"},
    {id: "color", header: "Color"},
    {id: "parent_task_id", header: "Parent Task"},
    {id: "is_trophy", header: "Trophy?"},
    {id: "task_status_id", header: "Status"},
    {id: "project_id", header: "Project"},
    {id: "route_pos_x", header: "Route Pos X", hidden: true},
    {id: "route_pos_y", header: "Route Pos Y", hidden: true},
    {id: "route_pos_manual", header: "Route Pos Manual", hidden: true},
    {id: "created_at", header: "Created At"},
    {id: "updated_at", header: "Updated At"},
]
export default task
