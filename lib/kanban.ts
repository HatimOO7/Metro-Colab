import { and, asc, eq } from "drizzle-orm";

import { calendarItems, db, kanbanBoards, kanbanColumns, kanbanTasks, type KanbanLabel, type KanbanTask } from "@/db";
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
    columns: columnsByBoard.get(board.id) ?? [],
  }));
}

export async function getBoardWithDetails(boardId: number, userId: number) {
  const board = await getUserBoard(boardId, userId);

  if (!board) {
    return null;
  }

  const columns = await db
    .select()
    .from(kanbanColumns)
    .where(eq(kanbanColumns.boardId, boardId))
    .orderBy(asc(kanbanColumns.position), asc(kanbanColumns.createdAt));
  const tasks = await db
    .select()
    .from(kanbanTasks)
    .where(eq(kanbanTasks.boardId, boardId))
    .orderBy(asc(kanbanTasks.columnId), asc(kanbanTasks.position), asc(kanbanTasks.createdAt));

  return hydrateBoards([board], columns, tasks)[0];
}

export async function getBoardsWithDetails(userId: number) {
  const boards = await db
    .select()
    .from(kanbanBoards)
    .where(eq(kanbanBoards.userId, userId))
    .orderBy(asc(kanbanBoards.createdAt));
  const columns = await db
    .select()
    .from(kanbanColumns)
    .innerJoin(kanbanBoards, eq(kanbanColumns.boardId, kanbanBoards.id))
    .where(eq(kanbanBoards.userId, userId))
    .orderBy(asc(kanbanColumns.position), asc(kanbanColumns.createdAt));
  const tasks = await db
    .select()
    .from(kanbanTasks)
    .innerJoin(kanbanBoards, eq(kanbanTasks.boardId, kanbanBoards.id))
    .where(eq(kanbanBoards.userId, userId))
    .orderBy(asc(kanbanTasks.position), asc(kanbanTasks.createdAt));

  return hydrateBoards(
    boards,
    columns.map((row) => row.kanban_columns),
    tasks.map((row) => row.kanban_tasks)
  );
}

export async function syncTaskToCalendar(task: KanbanTask, userId: number) {
  if (!task.syncCalendar) {
    if (task.calendarItemId) {
      await db
        .delete(calendarItems)
        .where(and(eq(calendarItems.id, task.calendarItemId), eq(calendarItems.userId, userId)));
      const [updatedTask] = await db
        .update(kanbanTasks)
        .set({ calendarItemId: null, updatedAt: new Date() })
        .where(eq(kanbanTasks.id, task.id))
        .returning();
      return updatedTask;
    }

    return task;
  }

  const category = priorityCategory[task.priority as keyof typeof priorityCategory] ?? priorityCategory.Medium;
  const calendarInput = {
    userId,
    title: task.title,
    description: task.description,
    itemType: "task",
    category: category.category,
    categoryColor: category.categoryColor,
    scheduledDate: task.dueDate,
    scheduledTime: null,
    status: "scheduled",
    updatedAt: new Date(),
  };

  if (task.calendarItemId) {
    const [item] = await db
      .update(calendarItems)
      .set(calendarInput)
      .where(and(eq(calendarItems.id, task.calendarItemId), eq(calendarItems.userId, userId)))
      .returning();

    if (item) {
      return task;
    }
  }

  const [item] = await db.insert(calendarItems).values(calendarInput).returning();
  const [updatedTask] = await db
    .update(kanbanTasks)
    .set({ calendarItemId: item.id, updatedAt: new Date() })
    .where(eq(kanbanTasks.id, task.id))
    .returning();

  return updatedTask;
}
