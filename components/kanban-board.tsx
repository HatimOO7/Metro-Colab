"use client";

import {
  CalendarDays,
  Check,
  ClipboardCheck,
  Edit3,
  GripVertical,
  Loader2,
  NotebookTabs,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type KanbanLabel = {
  name: string;
  color: string;
};

type KanbanTask = {
  id: number;
  boardId: number;
  columnId: number;
  title: string;
  description: string | null;
  dueDate: string;
  priority: "Low" | "Medium" | "High";
  labels: KanbanLabel[];
  syncCalendar: boolean;
  linkNotes: boolean;
  calendarItemId: number | null;
  position: number;
};

type KanbanColumn = {
  id: number;
  boardId: number;
  name: string;
  position: number;
  tasks: KanbanTask[];
};

type KanbanBoard = {
  id: number;
  userId: number;
  name: string;
  color: string;
  columns: KanbanColumn[];
};

type BoardForm = {
  name: string;
  color: string;
};

type TaskForm = {
  title: string;
  description: string;
  dueDate: string;
  priority: KanbanTask["priority"];
  labels: KanbanLabel[];
  syncCalendar: boolean;
  linkNotes: boolean;
};

const boardColors = ["#0ea5e9", "#10b981", "#f97316", "#e11d48", "#7c3aed", "#14b8a6"];
const labelColors = ["#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#64748b"];
const priorities: KanbanTask["priority"][] = ["Low", "Medium", "High"];
const priorityClasses = {
  Low: "bg-emerald-100 text-emerald-700",
  Medium: "bg-sky-100 text-sky-700",
  High: "bg-fuchsia-100 text-fuchsia-700",
};

function getTodayKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(year, month - 1, day));
}

function defaultTaskForm(): TaskForm {
  return {
    title: "",
    description: "",
    dueDate: getTodayKey(),
    priority: "Medium",
    labels: [],
    syncCalendar: false,
    linkNotes: false,
  };
}

function taskToForm(task: KanbanTask): TaskForm {
  return {
    title: task.title,
    description: task.description ?? "",
    dueDate: task.dueDate,
    priority: task.priority,
    labels: task.labels ?? [],
    syncCalendar: task.syncCalendar,
    linkNotes: task.linkNotes,
  };
}

function sortColumns(columns: KanbanColumn[]) {
  return [...columns]
    .sort((first, second) => first.position - second.position || first.id - second.id)
    .map((column) => ({
      ...column,
      tasks: [...column.tasks].sort((first, second) => first.position - second.position || first.id - second.id),
    }));
}

async function readPayload(response: Response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error ?? "Kanban request failed");
  }

  return payload;
}

export function KanbanBoardPage() {
  const [boards, setBoards] = React.useState<KanbanBoard[]>([]);
  const [selectedBoardId, setSelectedBoardId] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [boardDialogOpen, setBoardDialogOpen] = React.useState(false);
  const [editingBoard, setEditingBoard] = React.useState<KanbanBoard | null>(null);
  const [taskDialog, setTaskDialog] = React.useState<{ columnId: number; task: KanbanTask | null } | null>(null);
  const [draggingTaskId, setDraggingTaskId] = React.useState<number | null>(null);

  const selectedBoard = React.useMemo(
    () => boards.find((board) => board.id === selectedBoardId) ?? boards[0] ?? null,
    [boards, selectedBoardId]
  );
  const sortedSelectedBoard = selectedBoard
    ? { ...selectedBoard, columns: sortColumns(selectedBoard.columns) }
    : null;

  const replaceBoard = React.useCallback((board: KanbanBoard) => {
    setBoards((currentBoards) => currentBoards.map((currentBoard) => (currentBoard.id === board.id ? board : currentBoard)));
  }, []);

  const loadBoards = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/kanban/boards", { cache: "no-store" });
      const payload = await readPayload(response);
      const loadedBoards = (payload.boards ?? []) as KanbanBoard[];

      setBoards(loadedBoards);
      setSelectedBoardId((currentId) => {
        if (currentId && loadedBoards.some((board) => board.id === currentId)) {
          return currentId;
        }

        return loadedBoards[0]?.id ?? null;
      });
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Unable to load boards.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadBoards();
  }, [loadBoards]);

  async function handleSaveBoard(form: BoardForm) {
    setActionError(null);

    try {
      const response = await fetch(editingBoard ? `/api/kanban/boards/${editingBoard.id}` : "/api/kanban/boards", {
        method: editingBoard ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await readPayload(response);

      if (editingBoard) {
        replaceBoard(payload.board);
      } else {
        setBoards((currentBoards) => [...currentBoards, payload.board]);
        setSelectedBoardId(payload.board.id);
      }

      setBoardDialogOpen(false);
      setEditingBoard(null);
    } catch (saveError) {
      setActionError(saveError instanceof Error ? saveError.message : "Unable to save board.");
    }
  }

  async function handleDeleteBoard(board: KanbanBoard) {
    setActionError(null);

    try {
      const response = await fetch(`/api/kanban/boards/${board.id}`, { method: "DELETE" });
      await readPayload(response);
      const nextBoards = boards.filter((currentBoard) => currentBoard.id !== board.id);
      setBoards(nextBoards);
      setSelectedBoardId(nextBoards[0]?.id ?? null);
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : "Unable to delete board.");
    }
  }

  async function handleAddColumn() {
    if (!sortedSelectedBoard || sortedSelectedBoard.columns.length >= 5) {
      return;
    }

    const name = window.prompt("Column name", "New column")?.trim();

    if (!name) {
      return;
    }

    setActionError(null);

    try {
      const response = await fetch("/api/kanban/columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId: sortedSelectedBoard.id, name }),
      });
      const payload = await readPayload(response);
      replaceBoard(payload.board);
    } catch (createError) {
      setActionError(createError instanceof Error ? createError.message : "Unable to add column.");
    }
  }

  async function handleRenameColumn(column: KanbanColumn) {
    const name = window.prompt("Column name", column.name)?.trim();

    if (!name || name === column.name) {
      return;
    }

    setActionError(null);

    try {
      const response = await fetch(`/api/kanban/columns/${column.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = await readPayload(response);
      replaceBoard(payload.board);
    } catch (renameError) {
      setActionError(renameError instanceof Error ? renameError.message : "Unable to rename column.");
    }
  }

  async function handleDeleteColumn(column: KanbanColumn) {
    setActionError(null);

    try {
      const response = await fetch(`/api/kanban/columns/${column.id}`, { method: "DELETE" });
      const payload = await readPayload(response);
      replaceBoard(payload.board);
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : "Unable to delete column.");
    }
  }

  async function handleSaveTask(form: TaskForm) {
    if (!taskDialog || !sortedSelectedBoard) {
      return;
    }

    const isEditing = Boolean(taskDialog.task);
    const endpoint = isEditing ? `/api/kanban/tasks/${taskDialog.task?.id}` : "/api/kanban/tasks";
    const method = isEditing ? "PATCH" : "POST";
    setActionError(null);

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          boardId: sortedSelectedBoard.id,
          columnId: taskDialog.columnId,
        }),
      });
      const payload = await readPayload(response);
      replaceBoard(payload.board);
      setTaskDialog(null);
    } catch (saveError) {
      setActionError(saveError instanceof Error ? saveError.message : "Unable to save task.");
    }
  }

  async function handleDeleteTask(task: KanbanTask) {
    setActionError(null);

    try {
      const response = await fetch(`/api/kanban/tasks/${task.id}`, { method: "DELETE" });
      const payload = await readPayload(response);
      replaceBoard(payload.board);
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : "Unable to delete task.");
    }
  }

  async function handleTaskDrop(targetColumn: KanbanColumn) {
    if (!sortedSelectedBoard || !draggingTaskId) {
      return;
    }

    const sourceColumn = sortedSelectedBoard.columns.find((column) =>
      column.tasks.some((task) => task.id === draggingTaskId)
    );
    const draggedTask = sourceColumn?.tasks.find((task) => task.id === draggingTaskId);

    if (!sourceColumn || !draggedTask) {
      return;
    }

    const nextColumns = sortedSelectedBoard.columns.map((column) => {
      const remainingTasks = column.tasks.filter((task) => task.id !== draggingTaskId);
      const nextTasks =
        column.id === targetColumn.id
          ? [...remainingTasks, { ...draggedTask, columnId: targetColumn.id }]
          : remainingTasks;

      return {
        ...column,
        tasks: nextTasks.map((task, position) => ({ ...task, position })),
      };
    });
    const optimisticBoard = { ...sortedSelectedBoard, columns: nextColumns };

    replaceBoard(optimisticBoard);
    setDraggingTaskId(null);
    setActionError(null);

    try {
      const updates = nextColumns.flatMap((column) =>
        column.tasks.map((task) =>
          fetch(`/api/kanban/tasks/${task.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ columnId: column.id, position: task.position }),
          }).then(readPayload)
        )
      );
      const payloads = await Promise.all(updates);
      const latestBoard = [...payloads].reverse().find((payload) => payload.board)?.board as KanbanBoard | undefined;

      if (latestBoard) {
        replaceBoard(latestBoard);
      }
    } catch (moveError) {
      setActionError(moveError instanceof Error ? moveError.message : "Unable to move task.");
      replaceBoard(sortedSelectedBoard);
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 px-4 py-5 lg:px-6">
      {(error || actionError) && (
        <div className="rounded-lg border border-destructive/25 bg-red-50 px-3 py-2 text-sm text-destructive">
          {error ?? actionError}
          {error && (
            <button type="button" className="ml-2 font-semibold underline" onClick={() => void loadBoards()}>
              Retry
            </button>
          )}
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="min-w-0 rounded-lg border border-border bg-card p-3 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Boards</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{boards.length} active</p>
            </div>
            <Button
              type="button"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => {
                setEditingBoard(null);
                setBoardDialogOpen(true);
              }}
              aria-label="Create board"
              title="Create board"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="mt-3 space-y-1.5">
            {loading && (
              <>
                <div className="h-12 animate-pulse rounded-lg bg-muted" />
                <div className="h-12 animate-pulse rounded-lg bg-muted" />
              </>
            )}

            {!loading && boards.length === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-white/80 p-4 text-sm leading-6 text-muted-foreground">
                Create a board to start organizing tasks.
              </div>
            )}

            {!loading &&
              boards.map((board) => (
                <div
                  key={board.id}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg border px-2 py-2 transition",
                    selectedBoard?.id === board.id
                      ? "border-emerald-200 bg-emerald-50 text-foreground shadow-soft"
                      : "border-transparent hover:bg-white/80"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedBoardId(board.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: board.color }} />
                    <span className="truncate text-sm font-semibold">{board.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBoard(board);
                      setBoardDialogOpen(true);
                    }}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground opacity-0 transition hover:bg-white hover:text-foreground group-hover:opacity-100"
                    aria-label={`Edit ${board.name}`}
                    title="Edit board"
                  >
                    <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteBoard(board)}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground opacity-0 transition hover:bg-red-50 hover:text-destructive group-hover:opacity-100"
                    aria-label={`Delete ${board.name}`}
                    title="Delete board"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              ))}
          </div>
        </aside>

        <section className="min-w-0 rounded-lg border border-border bg-card p-3 shadow-soft sm:p-4">
          {!sortedSelectedBoard ? (
            <div className="grid min-h-[420px] place-items-center rounded-lg border border-dashed border-border bg-white/70 p-6 text-center">
              <div>
                <ClipboardCheck className="mx-auto h-9 w-9 text-emerald-600" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold">No board selected</p>
                <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                  Create a board and Metro Colab will add Todo, In Progress, and Done columns.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: sortedSelectedBoard.color }} />
                    <h2 className="truncate text-xl font-semibold">{sortedSelectedBoard.name}</h2>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {sortedSelectedBoard.columns.length}/5 columns
                  </p>
                </div>

                <Button
                  type="button"
                  className="h-9 rounded-lg bg-foreground text-xs text-background hover:bg-foreground/90"
                  onClick={() => void handleAddColumn()}
                  disabled={sortedSelectedBoard.columns.length >= 5}
                >
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  Add column
                </Button>
              </div>

              <div className="mt-4 min-w-0 overflow-x-auto pb-2">
                <div className="flex min-h-[460px] w-max gap-3 pr-2">
                  {sortedSelectedBoard.columns.map((column) => (
                    <KanbanColumnView
                      key={column.id}
                      column={column}
                      onAddTask={() => setTaskDialog({ columnId: column.id, task: null })}
                      onRename={() => void handleRenameColumn(column)}
                      onDelete={() => void handleDeleteColumn(column)}
                      onEditTask={(task) => setTaskDialog({ columnId: column.id, task })}
                      onDeleteTask={(task) => void handleDeleteTask(task)}
                      onDragStart={(task) => setDraggingTaskId(task.id)}
                      onDrop={() => void handleTaskDrop(column)}
                      draggingTaskId={draggingTaskId}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {boardDialogOpen && (
        <BoardDialog
          board={editingBoard}
          error={actionError}
          onClose={() => {
            setBoardDialogOpen(false);
            setEditingBoard(null);
          }}
          onSave={handleSaveBoard}
        />
      )}

      {taskDialog && (
        <KanbanTaskDialog
          task={taskDialog.task}
          error={actionError}
          onClose={() => setTaskDialog(null)}
          onSave={handleSaveTask}
        />
      )}
    </div>
  );
}

function KanbanColumnView({
  column,
  onAddTask,
  onRename,
  onDelete,
  onEditTask,
  onDeleteTask,
  onDragStart,
  onDrop,
  draggingTaskId,
}: {
  column: KanbanColumn;
  onAddTask: () => void;
  onRename: () => void;
  onDelete: () => void;
  onEditTask: (task: KanbanTask) => void;
  onDeleteTask: (task: KanbanTask) => void;
  onDragStart: (task: KanbanTask) => void;
  onDrop: () => void;
  draggingTaskId: number | null;
}) {
  return (
    <div
      className={cn(
        "flex h-full w-[280px] shrink-0 flex-col rounded-lg border border-border bg-white/85",
        draggingTaskId && "ring-1 ring-emerald-200"
      )}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{column.name}</p>
          <p className="text-[11px] text-muted-foreground">{column.tasks.length} tasks</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onRename}
            className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label={`Rename ${column.name}`}
            title="Rename column"
          >
            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-red-50 hover:text-destructive"
            aria-label={`Delete ${column.name}`}
            title="Delete column"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2.5">
        {column.tasks.map((task) => (
          <KanbanTaskCard
            key={task.id}
            task={task}
            onEdit={() => onEditTask(task)}
            onDelete={() => onDeleteTask(task)}
            onDragStart={() => onDragStart(task)}
          />
        ))}

        {column.tasks.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-center text-xs leading-5 text-muted-foreground">
            Drop a task here or create one.
          </div>
        )}
      </div>

      <div className="border-t border-border p-2.5">
        <Button type="button" variant="outline" className="h-9 w-full rounded-lg bg-white text-xs" onClick={onAddTask}>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Add task
        </Button>
      </div>
    </div>
  );
}

function KanbanTaskCard({
  task,
  onEdit,
  onDelete,
  onDragStart,
}: {
  task: KanbanTask;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/kanban-task-id", String(task.id));
        event.dataTransfer.setData("text/plain", String(task.id));
        event.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onClick={onEdit}
      className="group cursor-pointer rounded-lg border border-border bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft"
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onEdit();
        }
      }}
      aria-label={`Edit ${task.title}`}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-5">{task.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className={cn("rounded-lg px-2 py-1 text-[11px] font-semibold", priorityClasses[task.priority])}>
              {task.priority}
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
              <CalendarDays className="h-3 w-3" aria-hidden="true" />
              {formatDateLabel(task.dueDate)}
            </span>
          </div>
          {task.labels.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {task.labels.map((label) => (
                <span
                  key={`${task.id}-${label.name}-${label.color}`}
                  className="rounded-lg px-2 py-0.5 text-[10px] font-semibold text-white"
                  style={{ backgroundColor: label.color }}
                >
                  {label.name}
                </span>
              ))}
            </div>
          )}
          <div className="mt-2 flex items-center gap-1.5 text-muted-foreground">
            {task.syncCalendar && (
              <span title="Synced to calendar" aria-label="Synced to calendar">
                <CalendarDays className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
              </span>
            )}
            {task.linkNotes && (
              <span title="Linked to notes" aria-label="Linked to notes">
                <NotebookTabs className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground opacity-0 transition hover:bg-red-50 hover:text-destructive group-hover:opacity-100"
          aria-label={`Delete ${task.title}`}
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function BoardDialog({
  board,
  error,
  onClose,
  onSave,
}: {
  board: KanbanBoard | null;
  error: string | null;
  onClose: () => void;
  onSave: (form: BoardForm) => Promise<void>;
}) {
  const [form, setForm] = React.useState<BoardForm>(() => ({
    name: board?.name ?? "",
    color: board?.color ?? boardColors[0],
  }));
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit() {
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-4 shadow-soft">
        <DialogHeader title={board ? "Edit board" : "Create board"} onClose={onClose} />
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">Name</span>
            <input
              value={form.name}
              onChange={(event) => setForm((currentForm) => ({ ...currentForm, name: event.target.value }))}
              className="mt-1 h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring/30"
              placeholder="Launch board"
              autoFocus
            />
          </label>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Color</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {boardColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm((currentForm) => ({ ...currentForm, color }))}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-border"
                  style={{ backgroundColor: color }}
                  aria-label={`Choose ${color}`}
                  title={color}
                >
                  {form.color === color && <Check className="h-4 w-4 text-white" aria-hidden="true" />}
                </button>
              ))}
            </div>
          </div>
          {error && <div className="rounded-lg border border-destructive/25 bg-red-50 px-3 py-2 text-sm text-destructive">{error}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" className="h-9 rounded-lg bg-white text-xs" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              className="h-9 rounded-lg bg-foreground text-xs text-background hover:bg-foreground/90"
              onClick={() => void handleSubmit()}
              disabled={saving || !form.name.trim()}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="mr-2 h-4 w-4" aria-hidden="true" />}
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function KanbanTaskDialog({
  task,
  error,
  onClose,
  onSave,
}: {
  task: KanbanTask | null;
  error: string | null;
  onClose: () => void;
  onSave: (form: TaskForm) => Promise<void>;
}) {
  const [form, setForm] = React.useState<TaskForm>(() => (task ? taskToForm(task) : defaultTaskForm()));
  const [labelName, setLabelName] = React.useState("");
  const [labelColor, setLabelColor] = React.useState(labelColors[0]);
  const [saving, setSaving] = React.useState(false);

  function updateForm<Field extends keyof TaskForm>(field: Field, value: TaskForm[Field]) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function addLabel() {
    const name = labelName.trim();

    if (!name) {
      return;
    }

    updateForm("labels", [...form.labels, { name, color: labelColor }].slice(0, 6));
    setLabelName("");
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-lg border border-border bg-card p-4 shadow-soft">
        <DialogHeader title={task ? "Edit task" : "Create task"} onClose={onClose} />
        <form className="mt-4 space-y-3" onSubmit={(event) => event.preventDefault()}>
          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">Title</span>
            <input
              value={form.title}
              onChange={(event) => updateForm("title", event.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring/30"
              placeholder="Write release notes"
              autoFocus
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">Description</span>
            <textarea
              value={form.description}
              onChange={(event) => updateForm("description", event.target.value)}
              className="mt-1 min-h-24 w-full resize-none rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-ring/30"
              placeholder="Add context, blockers, or acceptance notes"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">Due date</span>
              <input
                type="date"
                value={form.dueDate}
                onChange={(event) => updateForm("dueDate", event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring/30"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">Priority</span>
              <select
                value={form.priority}
                onChange={(event) => updateForm("priority", event.target.value as TaskForm["priority"])}
                className="mt-1 h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring/30"
              >
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground">Labels</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {form.labels.map((label, index) => (
                <button
                  key={`${label.name}-${label.color}-${index}`}
                  type="button"
                  onClick={() => updateForm("labels", form.labels.filter((_, labelIndex) => labelIndex !== index))}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-white"
                  style={{ backgroundColor: label.color }}
                  title="Remove label"
                >
                  {label.name}
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              ))}
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <input
                value={labelName}
                onChange={(event) => setLabelName(event.target.value)}
                className="h-10 rounded-lg border border-input bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring/30"
                placeholder="Frontend"
              />
              <select
                value={labelColor}
                onChange={(event) => setLabelColor(event.target.value)}
                className="h-10 rounded-lg border border-input bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring/30"
              >
                {labelColors.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
              <Button type="button" variant="outline" className="h-10 rounded-lg bg-white text-xs" onClick={addLabel}>
                Add
              </Button>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={form.syncCalendar}
                onChange={(event) => updateForm("syncCalendar", event.target.checked)}
                className="h-4 w-4 accent-emerald-600"
              />
              <CalendarDays className="h-4 w-4 text-sky-600" aria-hidden="true" />
              Sync calendar
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={form.linkNotes}
                onChange={(event) => updateForm("linkNotes", event.target.checked)}
                className="h-4 w-4 accent-emerald-600"
              />
              <NotebookTabs className="h-4 w-4 text-amber-600" aria-hidden="true" />
              Link notes
            </label>
          </div>

          {error && <div className="rounded-lg border border-destructive/25 bg-red-50 px-3 py-2 text-sm text-destructive">{error}</div>}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="h-9 rounded-lg bg-white text-xs" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              className="h-9 rounded-lg bg-foreground text-xs text-background hover:bg-foreground/90"
              onClick={() => void handleSubmit()}
              disabled={saving || !form.title.trim() || !form.dueDate}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="mr-2 h-4 w-4" aria-hidden="true" />}
              Save task
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DialogHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <p className="text-sm font-semibold">{title}</p>
      <button
        type="button"
        onClick={onClose}
        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
        aria-label="Close dialog"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
