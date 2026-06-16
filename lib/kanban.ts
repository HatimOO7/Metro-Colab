import { and, asc, eq, or, sql, desc, inArray } from "drizzle-orm";

import { calendarItems, db, kanbanBoards, kanbanColumns, kanbanTasks, users, type KanbanLabel, type KanbanTask } from "@/db";
import { normalizeCalendarDateKey } from "@/lib/calendar-items";
import { syncCurrentUserToDatabase } from "@/lib/sync-user";

export const defaultKanbanColumns = ["Todo", "In Progress", "Done"];
export const maxKanbanColumns = 5;
export const allowedKanbanPriorities = new Set(["Low", "Medium", "High"]);

const priorityCategory = {
  Low: { category: "Focus", categoryColor: "violet" },
  Medium: { category: "Work", categoryColor: "sky" },
  High: { category: "Urgent", categoryColor: "fuchsia" },
} as const;

export function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeOptionalText(value: unknown) {
  const text = normalizeText(value);
  return text.length > 0 ? text : null;
}

export function normalizeBoolean(value: unknown) {
  return value === true;
}

export function normalizeLabels(value: unknown): KanbanLabel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((label) => {
      if (!label || typeof label !== "object") {
        return null;
      }

      const record = label as Record<string, unknown>;
      const name = normalizeText(record.name);
      const color = normalizeText(record.color);

      return name && color ? { name, color } : null;
    })
    .filter((label): label is KanbanLabel => Boolean(label))
    .slice(0, 6);
}

export function getTodayKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export async function getDatabaseUser() {
  const user = await syncCurrentUserToDatabase();

  if (!user) {
    return null;
  }

  return user;
}

export async function getUserBoard(boardId: number, userId: number) {
  const [board] = await db
    .select()
    .from(kanbanBoards)
    .where(and(eq(kanbanBoards.id, boardId), eq(kanbanBoards.userId, userId)));

  return board ?? null;
}

export async function getUserColumn(columnId: number, userId: number) {
  const [row] = await db
    .select({ column: kanbanColumns, board: kanbanBoards })
    .from(kanbanColumns)
    .innerJoin(kanbanBoards, eq(kanbanColumns.boardId, kanbanBoards.id))
    .where(and(eq(kanbanColumns.id, columnId), eq(kanbanBoards.userId, userId)));

  return row ?? null;
}

export async function getUserTask(taskId: number, userId: number) {
  const [row] = await db
    .select({ task: kanbanTasks, board: kanbanBoards })
    .from(kanbanTasks)
    .innerJoin(kanbanBoards, eq(kanbanTasks.boardId, kanbanBoards.id))
    .where(and(eq(kanbanTasks.id, taskId), eq(kanbanBoards.userId, userId)));

  return row ?? null;
}

type KanbanBoardRow = typeof kanbanBoards.$inferSelect;
type KanbanColumnRow = typeof kanbanColumns.$inferSelect;
type KanbanTaskRow = typeof kanbanTasks.$inferSelect;

function hydrateBoards(boards: KanbanBoardRow[], columns: KanbanColumnRow[], tasks: KanbanTaskRow[]) {
  const tasksByColumn = new Map<number, KanbanTaskRow[]>();

  for (const task of tasks) {
    const columnTasks = tasksByColumn.get(task.columnId) ?? [];
    columnTasks.push(task);
    tasksByColumn.set(task.columnId, columnTasks);
  }

  const columnsByBoard = new Map<number, Array<KanbanColumnRow & { tasks: KanbanTaskRow[] }>>();

  for (const column of columns) {
    const boardColumns = columnsByBoard.get(column.boardId) ?? [];
    boardColumns.push({ ...column, tasks: tasksByColumn.get(column.id) ?? [] });
    columnsByBoard.set(column.boardId, boardColumns);
  }

  return boards.map((board) => ({
    ...board,
    columns: (columnsByBoard.get(board.id) ?? []).sort(
      (first, second) => first.position - second.position || first.id - second.id
    ),
  }));
}

type KanbanBoardClient = KanbanBoardRow & { ownerEmail?: string };

type JoinRow = {
  board: KanbanBoardRow;
  ownerEmail?: string | null;
  column: KanbanColumnRow | null;
  task: KanbanTaskRow | null;
};

function hydrateFromJoinRows(rows: JoinRow[]) {
  if (rows.length === 0) {
    return [];
  }

  const boardsMap = new Map<number, KanbanBoardClient>();
  const columnsMap = new Map<number, KanbanColumnRow>();
  const tasksMap = new Map<number, KanbanTaskRow>();

  for (const row of rows) {
    boardsMap.set(row.board.id, { ...row.board, ownerEmail: row.ownerEmail ?? undefined });

    if (row.column) {
      columnsMap.set(row.column.id, row.column);
    }

    if (row.task) {
      tasksMap.set(row.task.id, row.task);
    }
  }

  const boards = [...boardsMap.values()].sort(
    (first, second) => first.createdAt.getTime() - second.createdAt.getTime()
  );
  const columns = [...columnsMap.values()].sort(
    (first, second) => first.position - second.position || first.id - second.id
  );
  const tasks = [...tasksMap.values()].sort(
    (first, second) =>
      first.columnId - second.columnId ||
      first.position - second.position ||
      first.id - second.id
  );

  return hydrateBoards(boards, columns, tasks);
}

export async function getBoardWithDetails(boardId: number, userId: number) {
  const rows = await db
    .select({
      board: kanbanBoards,
      ownerEmail: users.email,
      column: kanbanColumns,
      task: kanbanTasks,
    })
    .from(kanbanBoards)
    .innerJoin(users, eq(kanbanBoards.userId, users.id))
    .leftJoin(kanbanColumns, eq(kanbanColumns.boardId, kanbanBoards.id))
    .leftJoin(kanbanTasks, eq(kanbanTasks.boardId, kanbanBoards.id))
    .where(and(eq(kanbanBoards.id, boardId), eq(kanbanBoards.userId, userId)))
    .orderBy(
      asc(kanbanColumns.position),
      asc(kanbanColumns.createdAt),
      asc(kanbanTasks.columnId),
      asc(kanbanTasks.position),
      asc(kanbanTasks.createdAt)
    );

  if (rows.length === 0) {
    return null;
  }

  return hydrateFromJoinRows(rows)[0] ?? null;
}

export async function getBoardsWithDetails(userId: number, email?: string) {
  const whereClause = email
    ? or(
        eq(kanbanBoards.userId, userId),
        sql`${kanbanBoards.sharedEmails} @> ${JSON.stringify([email])}::jsonb`
      )
    : eq(kanbanBoards.userId, userId);

  const boardsRows = await db
    .select({
      board: kanbanBoards,
      ownerEmail: users.email,
    })
    .from(kanbanBoards)
    .innerJoin(users, eq(kanbanBoards.userId, users.id))
    .where(whereClause)
    .orderBy(asc(kanbanBoards.createdAt));

  if (boardsRows.length === 0) return [];

  const boardIds = boardsRows.map((row) => row.board.id);

  const [columnsRows, tasksRows] = await Promise.all([
    db
      .select()
      .from(kanbanColumns)
      .where(inArray(kanbanColumns.boardId, boardIds))
      .orderBy(asc(kanbanColumns.position), asc(kanbanColumns.createdAt)),
    db
      .select()
      .from(kanbanTasks)
      .where(inArray(kanbanTasks.boardId, boardIds))
      .orderBy(asc(kanbanTasks.position), asc(kanbanTasks.createdAt)),
  ]);

  const boardsMap = new Map();

  for (const { board, ownerEmail } of boardsRows) {
    boardsMap.set(board.id, {
      ...board,
      ownerEmail,
      columns: [],
    });
  }

  const columnsMap = new Map();

  for (const col of columnsRows) {
    const columnWithTasks = { ...col, tasks: [] };
    columnsMap.set(col.id, columnWithTasks);
    
    const board = boardsMap.get(col.boardId);
    if (board) board.columns.push(columnWithTasks);
  }

  for (const task of tasksRows) {
    const col = columnsMap.get(task.columnId);
    if (col) col.tasks.push(task);
  }

  return Array.from(boardsMap.values());
}

export type KanbanCalendarSyncResult = {
  task: KanbanTask;
  calendarItem: typeof calendarItems.$inferSelect | null;
};

export async function getKanbanTaskByCalendarItemId(calendarItemId: number, userId: number) {
  const [row] = await db
    .select({ task: kanbanTasks })
    .from(kanbanTasks)
    .innerJoin(kanbanBoards, eq(kanbanTasks.boardId, kanbanBoards.id))
    .where(and(eq(kanbanTasks.calendarItemId, calendarItemId), eq(kanbanBoards.userId, userId)));

  return row?.task ?? null;
}

export async function syncCalendarDateToKanbanTask(
  calendarItemId: number,
  scheduledDate: string | null,
  userId: number
) {
  const normalizedDate = normalizeCalendarDateKey(scheduledDate);

  if (!normalizedDate) {
    return null;
  }

  const linkedTask = await getKanbanTaskByCalendarItemId(calendarItemId, userId);

  if (!linkedTask) {
    return null;
  }

  const [updatedTask] = await db
    .update(kanbanTasks)
    .set({ dueDate: normalizedDate, updatedAt: new Date() })
    .where(eq(kanbanTasks.id, linkedTask.id))
    .returning();

  return updatedTask ?? null;
}

export async function syncTaskToCalendar(task: KanbanTask, userId: number): Promise<KanbanCalendarSyncResult> {
  const now = new Date();

  if (!task.syncCalendar) {
    if (!task.calendarItemId) {
      return { task, calendarItem: null };
    }

    await db
      .delete(calendarItems)
      .where(and(eq(calendarItems.id, task.calendarItemId), eq(calendarItems.userId, userId)));
    const [updatedTask] = await db
      .update(kanbanTasks)
      .set({ calendarItemId: null, updatedAt: now })
      .where(eq(kanbanTasks.id, task.id))
      .returning();

    return { task: updatedTask ?? task, calendarItem: null };
  }

  const category = priorityCategory[task.priority as keyof typeof priorityCategory] ?? priorityCategory.Medium;
  const scheduledDate = normalizeCalendarDateKey(task.dueDate) ?? getTodayKey();
  const calendarInput = {
    userId,
    title: task.title,
    description: task.description,
    itemType: "task" as const,
    category: category.category,
    categoryColor: category.categoryColor,
    scheduledDate,
    scheduledTime: null,
    status: "scheduled" as const,
    updatedAt: now,
  };

  if (task.calendarItemId) {
    const [item] = await db
      .update(calendarItems)
      .set(calendarInput)
      .where(and(eq(calendarItems.id, task.calendarItemId), eq(calendarItems.userId, userId)))
      .returning();

    if (item) {
      const [updatedTask] = await db
        .select()
        .from(kanbanTasks)
        .where(eq(kanbanTasks.id, task.id));

      return { task: updatedTask ?? task, calendarItem: item };
    }
  }

  const [item] = await db.insert(calendarItems).values(calendarInput).returning();

  if (!item) {
    throw new Error("Failed to create linked calendar item");
  }

  const [updatedTask] = await db
    .update(kanbanTasks)
    .set({ calendarItemId: item.id, updatedAt: now })
    .where(eq(kanbanTasks.id, task.id))
    .returning();

  if (!updatedTask) {
    throw new Error("Failed to save calendar link on kanban task");
  }

  return { task: updatedTask, calendarItem: item };
}

export async function deleteTaskCalendarItem(calendarItemId: number, userId: number) {
  await db
    .delete(calendarItems)
    .where(and(eq(calendarItems.id, calendarItemId), eq(calendarItems.userId, userId)));
}
