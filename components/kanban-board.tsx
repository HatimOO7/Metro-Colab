"use client";

import { useUser } from "@clerk/nextjs";
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
  Users,
  MessageSquare,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import {
  LiveblocksProvider,
  RoomProvider,
  ClientSideSuspense,
  useOthers,
  useThreads,
  useCreateThread,
} from "@liveblocks/react/suspense";
import { Thread, Composer } from "@liveblocks/react-ui";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  collectKanbanSearchResults,
  filterKanbanBoards,
  mapApiCalendarItemFromPayload,
  useWorkspaceData,
  type KanbanBoard,
  type KanbanColumn,
  type KanbanLabel,
  type KanbanTask,
} from "@/components/workspace-data";
import { cn } from "@/lib/utils";

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

const ThreadCountsContext = React.createContext<Map<string, number>>(new Map());

function ThreadCountsProvider({ children }: { children: React.ReactNode }) {
  const { threads } = useThreads();

  const countsByTaskId = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const thread of threads ?? []) {
      const taskId = thread.metadata?.taskId as string | undefined;
      if (taskId) {
        map.set(taskId, (map.get(taskId) ?? 0) + thread.comments.length);
      }
    }
    return map;
  }, [threads]);

  return (
    <ThreadCountsContext.Provider value={countsByTaskId}>
      {children}
    </ThreadCountsContext.Provider>
  );
}

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
  if (!columns) return [];
  return [...columns]
    .sort((first, second) => first.position - second.position || first.id - second.id)
    .map((column) => ({
      ...column,
      tasks: column.tasks ? [...column.tasks].sort((first, second) => first.position - second.position || first.id - second.id) : [],
    }));
}

function insertTaskInColumn(board: KanbanBoard, columnId: number, task: KanbanTask): KanbanBoard {
  return {
    ...board,
    columns: board.columns.map((column) => {
      if (column.id !== columnId) {
        return column;
      }

      const tasks = [...column.tasks, { ...task, columnId }];
      return { ...column, tasks: tasks.map((currentTask, position) => ({ ...currentTask, position })) };
    }),
  };
}

function updateTaskInBoard(board: KanbanBoard, taskId: number, patch: Partial<KanbanTask>): KanbanBoard {
  return {
    ...board,
    columns: board.columns.map((column) => ({
      ...column,
      tasks: column.tasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task)),
    })),
  };
}

function removeTaskFromBoard(board: KanbanBoard, taskId: number): KanbanBoard {
  return {
    ...board,
    columns: board.columns.map((column) => {
      const tasks = column.tasks.filter((task) => task.id !== taskId);

      if (tasks.length === column.tasks.length) {
        return column;
      }

      return { ...column, tasks: tasks.map((task, position) => ({ ...task, position })) };
    }),
  };
}

function replaceTempTask(board: KanbanBoard, tempId: number, serverTask: KanbanTask): KanbanBoard {
  return {
    ...board,
    columns: board.columns.map((column) => ({
      ...column,
      tasks: column.tasks.map((task) => (task.id === tempId ? { ...serverTask, columnId: column.id } : task)),
    })),
  };
}

async function readPayload(response: Response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error ?? "Kanban request failed");
  }

  return payload;
}

export function KanbanBoardPage() {
  const {
    searchQuery,
    kanbanBoards,
    kanbanLoading,
    kanbanReady,
    kanbanError,
    setKanbanBoards,
    reloadKanbanBoards,
    createBoardRequested,
    clearCreateBoardRequest,
    upsertCalendarItem,
    removeCalendarItem,
    reloadCalendarItems,
    pendingKanbanTaskEdit,
    clearKanbanTaskEditRequest,
  } = useWorkspaceData();

  const [selectedBoardId, setSelectedBoardId] = React.useState<number | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [boardDialogOpen, setBoardDialogOpen] = React.useState(false);
  const [editingBoard, setEditingBoard] = React.useState<KanbanBoard | null>(null);
  const [taskDialog, setTaskDialog] = React.useState<{ columnId: number; task: KanbanTask | null } | null>(null);
  const [draggingTaskId, setDraggingTaskId] = React.useState<number | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = React.useState(false);

  const loading = kanbanLoading && !kanbanReady;
  const error = kanbanError;
  const boards = React.useMemo(
    () => filterKanbanBoards(kanbanBoards, searchQuery),
    [kanbanBoards, searchQuery]
  );
  const searchResults = React.useMemo(
    () => collectKanbanSearchResults(kanbanBoards, searchQuery),
    [kanbanBoards, searchQuery]
  );

  React.useEffect(() => {
    if (!kanbanReady || boards.length === 0) {
      return;
    }

    setSelectedBoardId((currentId) => {
      if (currentId && boards.some((board) => board.id === currentId)) {
        return currentId;
      }

      return boards[0]?.id ?? null;
    });
  }, [boards, kanbanReady]);

  React.useEffect(() => {
    if (!createBoardRequested) {
      return;
    }

    setEditingBoard(null);
    setBoardDialogOpen(true);
    clearCreateBoardRequest();
  }, [clearCreateBoardRequest, createBoardRequested]);

  React.useEffect(() => {
    if (!pendingKanbanTaskEdit || !kanbanReady) {
      return;
    }

    const { boardId, columnId, taskId } = pendingKanbanTaskEdit;
    const task = kanbanBoards
      .find((board) => board.id === boardId)
      ?.columns.flatMap((column) => column.tasks)
      .find((currentTask) => currentTask.id === taskId);

    setSelectedBoardId(boardId);

    if (!task) {
      return;
    }

    setTaskDialog({ columnId, task });
    clearKanbanTaskEditRequest();
  }, [clearKanbanTaskEditRequest, kanbanBoards, kanbanReady, pendingKanbanTaskEdit]);

  const selectedBoard = React.useMemo(
    () => boards.find((board) => board.id === selectedBoardId) ?? boards[0] ?? null,
    [boards, selectedBoardId]
  );
  const sortedSelectedBoard = React.useMemo(
    () => (selectedBoard ? { ...selectedBoard, columns: sortColumns(selectedBoard.columns) } : null),
    [selectedBoard]
  );

  const replaceBoard = React.useCallback(
    (board: KanbanBoard) => {
      setKanbanBoards((currentBoards) =>
        currentBoards.map((currentBoard) => (currentBoard.id === board.id ? board : currentBoard))
      );
    },
    [setKanbanBoards]
  );

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
        setKanbanBoards((currentBoards) => [...currentBoards, payload.board]);
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
      const nextBoards = kanbanBoards.filter((currentBoard) => currentBoard.id !== board.id);
      setKanbanBoards(nextBoards);
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

  const handleRenameColumn = React.useCallback(
    async (column: KanbanColumn) => {
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
        const message = renameError instanceof Error ? renameError.message : "Unable to rename column.";
        setActionError(message);
        toast.error(message);
      }
    },
    [replaceBoard]
  );

  const handleDeleteColumn = React.useCallback(
    async (column: KanbanColumn) => {
      setActionError(null);

      try {
        const response = await fetch(`/api/kanban/columns/${column.id}`, { method: "DELETE" });
        const payload = await readPayload(response);
        replaceBoard(payload.board);
      } catch (deleteError) {
        const message = deleteError instanceof Error ? deleteError.message : "Unable to delete column.";
        setActionError(message);
        toast.error(message);
      }
    },
    [replaceBoard]
  );

  const openTaskDialog = React.useCallback((columnId: number, task: KanbanTask | null) => {
    setTaskDialog({ columnId, task });
  }, []);

  const handleAddTask = React.useCallback(
    (columnId: number) => {
      openTaskDialog(columnId, null);
    },
    [openTaskDialog]
  );

  const handleSaveTask = React.useCallback(
    async (form: TaskForm) => {
      if (!taskDialog || !sortedSelectedBoard) {
        return;
      }

      const isEditing = Boolean(taskDialog.task);
      const endpoint = isEditing ? `/api/kanban/tasks/${taskDialog.task?.id}` : "/api/kanban/tasks";
      const method = isEditing ? "PATCH" : "POST";
      const boardId = sortedSelectedBoard.id;
      const columnId = taskDialog.columnId;
      const editingTaskId = taskDialog.task?.id ?? null;
      const tempTaskId = isEditing ? null : -Date.now();
      const shouldRefreshCalendar = form.syncCalendar || Boolean(taskDialog.task?.syncCalendar);
      const previousCalendarItemId = taskDialog.task?.calendarItemId ?? null;
      let previousBoard: KanbanBoard | null = null;

      setActionError(null);
      setKanbanBoards((currentBoards) =>
        currentBoards.map((board) => {
          if (board.id !== boardId) {
            return board;
          }

          previousBoard = board;

          if (isEditing && editingTaskId) {
            return updateTaskInBoard(board, editingTaskId, {
              title: form.title,
              description: form.description || null,
              dueDate: form.dueDate,
              priority: form.priority,
              labels: form.labels,
              syncCalendar: form.syncCalendar,
              linkNotes: form.linkNotes,
            });
          }

          const column = board.columns.find((currentColumn) => currentColumn.id === columnId);
          const optimisticTask: KanbanTask = {
            id: tempTaskId!,
            boardId,
            columnId,
            title: form.title,
            description: form.description || null,
            dueDate: form.dueDate,
            priority: form.priority,
            labels: form.labels,
            syncCalendar: form.syncCalendar,
            linkNotes: form.linkNotes,
            calendarItemId: null,
            position: column?.tasks.length ?? 0,
          };

          return insertTaskInColumn(board, columnId, optimisticTask);
        })
      );
      setTaskDialog(null);

      try {
        const response = await fetch(endpoint, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            boardId,
            columnId,
          }),
        });
        const payload = await readPayload(response);
        const serverTask = payload.task as KanbanTask;
        const syncedCalendarItem = mapApiCalendarItemFromPayload(payload.calendarItem);

        if (payload.board) {
          replaceBoard(payload.board as KanbanBoard);
        } else {
          setKanbanBoards((currentBoards) =>
            currentBoards.map((board) => {
              if (board.id !== boardId) {
                return board;
              }

              if (isEditing && editingTaskId) {
                return updateTaskInBoard(board, editingTaskId, serverTask);
              }

              if (tempTaskId) {
                return replaceTempTask(board, tempTaskId, serverTask);
              }

              return board;
            })
          );
        }

        if (syncedCalendarItem) {
          upsertCalendarItem(syncedCalendarItem);
        } else if (!serverTask.syncCalendar && previousCalendarItemId) {
          removeCalendarItem(previousCalendarItemId);
        } else if (shouldRefreshCalendar || serverTask.syncCalendar) {
          await reloadCalendarItems({ silent: true });
        }
      } catch (saveError) {
        if (previousBoard) {
          replaceBoard(previousBoard);
        }

        const message = saveError instanceof Error ? saveError.message : "Unable to save task.";
        setActionError(message);
        toast.error(message);
      }
    },
    [reloadCalendarItems, removeCalendarItem, replaceBoard, setKanbanBoards, sortedSelectedBoard, taskDialog, upsertCalendarItem]
  );

  const handleDeleteTask = React.useCallback(
    async (task: KanbanTask) => {
      if (!sortedSelectedBoard) {
        return;
      }

      const boardId = sortedSelectedBoard.id;
      let previousBoard: KanbanBoard | null = null;

      setActionError(null);
      setKanbanBoards((currentBoards) =>
        currentBoards.map((board) => {
          if (board.id !== boardId) {
            return board;
          }

          previousBoard = board;
          return removeTaskFromBoard(board, task.id);
        })
      );

      try {
        const response = await fetch(`/api/kanban/tasks/${task.id}`, { method: "DELETE" });
        const payload = await readPayload(response);

        if (payload.board) {
          replaceBoard(payload.board as KanbanBoard);
        }

        if (task.calendarItemId) {
          removeCalendarItem(task.calendarItemId);
        } else if (task.syncCalendar) {
          void reloadCalendarItems({ silent: true });
        }
      } catch (deleteError) {
        if (previousBoard) {
          replaceBoard(previousBoard);
        }

        const message = deleteError instanceof Error ? deleteError.message : "Unable to delete task.";
        setActionError(message);
        toast.error(message);
      }
    },
    [reloadCalendarItems, removeCalendarItem, replaceBoard, setKanbanBoards, sortedSelectedBoard]
  );

  const handleTaskDrop = React.useCallback(
    async (targetColumnId: number) => {
      if (!sortedSelectedBoard || !draggingTaskId) {
        return;
      }

      const boardId = sortedSelectedBoard.id;
      const activeTaskId = draggingTaskId;
      let previousBoard: KanbanBoard | null = null;
      let reorderPayload: {
        boardId: number;
        columns: Array<{ columnId: number; taskIds: number[] }>;
      } | null = null;

      setKanbanBoards((currentBoards) =>
        currentBoards.map((board) => {
          if (board.id !== boardId) {
            return board;
          }

          previousBoard = board;
          const sortedColumns = sortColumns(board.columns);
          const sourceColumn = sortedColumns.find((column) =>
            column.tasks.some((task) => task.id === activeTaskId)
          );
          const draggedTask = sourceColumn?.tasks.find((task) => task.id === activeTaskId);

          if (!sourceColumn || !draggedTask || sourceColumn.id === targetColumnId) {
            return board;
          }

          const nextColumns = sortedColumns.map((column) => {
            const remainingTasks = column.tasks.filter((task) => task.id !== activeTaskId);
            const nextTasks =
              column.id === targetColumnId
                ? [...remainingTasks, { ...draggedTask, columnId: targetColumnId }]
                : remainingTasks;

            return {
              ...column,
              tasks: nextTasks.map((task, position) => ({ ...task, position })),
            };
          });

          reorderPayload = {
            boardId,
            columns: nextColumns
              .filter((column) => column.id === sourceColumn.id || column.id === targetColumnId)
              .map((column) => ({
                columnId: column.id,
                taskIds: column.tasks.map((task) => task.id),
              })),
          };

          return { ...board, columns: nextColumns };
        })
      );
      setDraggingTaskId(null);
      setActionError(null);

      if (!reorderPayload) {
        return;
      }

      try {
        const response = await fetch("/api/kanban/tasks/reorder", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reorderPayload),
        });
        await readPayload(response);
      } catch (moveError) {
        if (previousBoard) {
          replaceBoard(previousBoard);
        }

        const message = moveError instanceof Error ? moveError.message : "Unable to move task.";
        setActionError(message);
        toast.error(message);
      }
    },
    [draggingTaskId, replaceBoard, setKanbanBoards, sortedSelectedBoard]
  );

  const handleDragStart = React.useCallback((taskId: number) => {
    setDraggingTaskId(taskId);
  }, []);

  const handleDragEnd = React.useCallback(() => {
    setDraggingTaskId(null);
  }, []);

  return (
    <LiveblocksProvider 
      authEndpoint="/api/liveblocks-auth"
      resolveUsers={async ({ userIds }) => {
        try {
          const searchParams = new URLSearchParams();
          userIds.forEach((id) => searchParams.append("userIds", id));
          const response = await fetch(`/api/liveblocks-users?${searchParams}`);
          if (!response.ok) return [];
          return response.json();
        } catch (error) {
          return [];
        }
      }}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 px-4 py-5 lg:px-6">
        {(error || actionError) && (
          <div className="rounded-lg border border-destructive/25 bg-red-50 px-3 py-2 text-sm text-destructive">
            {error ?? actionError}
            {error && (
              <button type="button" className="ml-2 font-semibold underline" onClick={() => void reloadKanbanBoards()}>
                Retry
              </button>
            )}
          </div>
        )}

        {searchQuery.trim() && searchResults.length > 0 && (
          <div className="rounded-lg border border-border bg-white p-3 shadow-soft">
            <p className="text-xs font-semibold text-muted-foreground">
              {searchResults.length} matching task{searchResults.length === 1 ? "" : "s"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {searchResults.map(({ board, column, task }) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => {
                    setSelectedBoardId(board.id);
                    setTaskDialog({ columnId: column.id, task });
                  }}
                  className="max-w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-left transition hover:bg-emerald-100"
                >
                  <span className="block truncate text-xs font-semibold text-foreground">{task.title}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {board.name} · {column.name}
                  </span>
                </button>
              ))}
            </div>
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
                <div className="space-y-1.5" aria-busy="true" aria-label="Loading boards">
                  <div className="h-12 animate-pulse rounded-lg bg-muted" />
                  <div className="h-12 animate-pulse rounded-lg bg-muted" />
                  <div className="h-12 animate-pulse rounded-lg bg-muted" />
                </div>
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
            {loading ? (
              <div className="space-y-4" aria-busy="true" aria-label="Loading kanban board">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 animate-pulse rounded-full bg-muted" />
                  <div className="h-6 w-40 animate-pulse rounded-md bg-muted" />
                </div>
                <div className="flex gap-3 overflow-hidden">
                  {[0, 1, 2].map((column) => (
                    <div key={column} className="w-[280px] shrink-0 space-y-2 rounded-lg border border-border bg-white/85 p-3">
                      <div className="h-5 w-24 animate-pulse rounded-md bg-muted" />
                      <div className="h-20 animate-pulse rounded-lg bg-muted" />
                      <div className="h-20 animate-pulse rounded-lg bg-muted" />
                    </div>
                  ))}
                </div>
              </div>
            ) : !sortedSelectedBoard ? (
              <div className="grid min-h-[420px] place-items-center rounded-lg border border-dashed border-border bg-white/70 p-6 text-center">
                <div>
                  <ClipboardCheck className="mx-auto h-9 w-9 text-emerald-600" aria-hidden="true" />
                  <p className="mt-3 text-sm font-semibold">
                    {searchQuery.trim() ? "No matching boards or tasks" : "No board selected"}
                  </p>
                  <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                    {searchQuery.trim()
                      ? "Try a different search term or clear the search bar."
                      : "Create a board and Metro Colab will add Todo, In Progress, and Done columns."}
                  </p>
                </div>
              </div>
            ) : (
              <RoomProvider id={`kanban-board-${sortedSelectedBoard.id}`} initialPresence={{}}>
                <ClientSideSuspense fallback={<div className="p-4 text-center text-sm text-muted-foreground">Loading collaboration...</div>}>
                  <ThreadCountsProvider>
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

                        <div className="flex items-center gap-2">
                          <ActiveCollaborators />
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9 rounded-lg bg-white text-xs hover:bg-muted"
                            onClick={() => setShareDialogOpen(true)}
                          >
                            <Users className="mr-2 h-4 w-4" aria-hidden="true" />
                            Share
                          </Button>
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
                      </div>

                      <div className="mt-4 min-w-0 overflow-x-auto pb-2">
                        <div className="flex min-h-[460px] w-max gap-3 pr-2">
                          {sortedSelectedBoard.columns.map((column) => {
                            const isDragSource = column.tasks.some((task) => task.id === draggingTaskId);
                            const isDropTarget = draggingTaskId !== null && !isDragSource;

                            return (
                              <KanbanColumnView
                                key={column.id}
                                column={column}
                                isDropTarget={isDropTarget}
                                onAddTask={handleAddTask}
                                onRename={handleRenameColumn}
                                onDelete={handleDeleteColumn}
                                onEditTask={openTaskDialog}
                                onDeleteTask={handleDeleteTask}
                                onDragStart={handleDragStart}
                                onDragEnd={handleDragEnd}
                                onDrop={handleTaskDrop}
                              />
                            );
                          })}
                        </div>
                      </div>
                      {taskDialog && (
                        <KanbanTaskSheet
                          task={taskDialog.task}
                          error={actionError}
                          onClose={() => setTaskDialog(null)}
                          onSave={handleSaveTask}
                        />
                      )}
                    </>
                  </ThreadCountsProvider>
                </ClientSideSuspense>
              </RoomProvider>
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

        {shareDialogOpen && sortedSelectedBoard && (
          <ShareBoardDialog
            board={sortedSelectedBoard}
            onClose={() => setShareDialogOpen(false)}
            onUpdateBoard={replaceBoard}
          />
        )}
      </div>
    </LiveblocksProvider>
  );
}

function ActiveCollaborators() {
  const others = useOthers();
  const activeCount = others.length;

  if (activeCount === 0) return null;

  return (
    <div className="flex items-center mr-2">
      <div className="flex -space-x-2">
        {others.slice(0, 3).map(({ connectionId, info }) => (
          <div
            key={connectionId}
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-xs font-semibold text-white shadow-sm"
            title={info?.name || "Anonymous"}
          >
            {info?.avatar ? (
              <img src={info.avatar} alt={info.name} className="h-full w-full rounded-full object-cover" />
            ) : (
              (info?.name || "A").charAt(0).toUpperCase()
            )}
          </div>
        ))}
        {activeCount > 3 && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-muted text-[10px] font-semibold text-muted-foreground shadow-sm">
            +{activeCount - 3}
          </div>
        )}
      </div>
    </div>
  );
}

const KanbanColumnView = React.memo(function KanbanColumnView({
  column,
  isDropTarget,
  onAddTask,
  onRename,
  onDelete,
  onEditTask,
  onDeleteTask,
  onDragStart,
  onDragEnd,
  onDrop,
}: {
  column: KanbanColumn;
  isDropTarget: boolean;
  onAddTask: (columnId: number) => void;
  onRename: (column: KanbanColumn) => void;
  onDelete: (column: KanbanColumn) => void;
  onEditTask: (columnId: number, task: KanbanTask) => void;
  onDeleteTask: (task: KanbanTask) => void;
  onDragStart: (taskId: number) => void;
  onDragEnd: () => void;
  onDrop: (columnId: number) => void;
}) {
  return (
    <div
      className={cn(
        "flex h-full w-[280px] shrink-0 flex-col rounded-lg border border-border bg-white/85",
        isDropTarget && "ring-1 ring-emerald-200"
      )}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(column.id);
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
            onClick={() => onRename(column)}
            className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label={`Rename ${column.name}`}
            title="Rename column"
          >
            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(column)}
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
            onEdit={() => onEditTask(column.id, task)}
            onDelete={() => onDeleteTask(task)}
            onDragStart={() => onDragStart(task.id)}
            onDragEnd={onDragEnd}
          />
        ))}

        {column.tasks.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-center text-xs leading-5 text-muted-foreground">
            Drop a task here or create one.
          </div>
        )}
      </div>

      <div className="border-t border-border p-2.5">
        <Button
          type="button"
          variant="outline"
          className="h-9 w-full rounded-lg bg-white text-xs"
          onClick={() => onAddTask(column.id)}
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Add task
        </Button>
      </div>
    </div>
  );
});

const KanbanTaskCard = React.memo(function KanbanTaskCard({
  task,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  task: KanbanTask;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
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
      onDragEnd={onDragEnd}
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
          <div className="mt-2 flex items-center justify-between text-muted-foreground">
            <div className="flex items-center gap-1.5">
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
            
            <TaskCommentsIndicator taskId={task.id} />
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
});

function TaskCommentsIndicator({ taskId }: { taskId: number }) {
  const countsByTaskId = React.useContext(ThreadCountsContext);
  const commentsCount = countsByTaskId.get(String(taskId)) ?? 0;

  if (commentsCount === 0) return null;

  return (
    <Badge
      variant="secondary"
      className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] h-6 font-semibold shadow-sm hover:bg-secondary/80 transition-colors"
    >
      <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
      {commentsCount}
    </Badge>
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

function KanbanTaskSheet({
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
    <Sheet open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent 
        className={cn(
          "p-0 flex flex-col md:flex-row overflow-hidden sm:max-w-xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl border-l-0 sm:border-l",
          !task && "md:max-w-xl"
        )}
      >
        <div className="flex flex-col flex-1 h-full max-h-[100dvh] overflow-y-auto p-6 relative">
          <SheetHeader className="mb-4 text-left">
            <SheetTitle>{task ? "Edit task" : "Create task"}</SheetTitle>
          </SheetHeader>
          <form className="space-y-4 flex-1" onSubmit={(event) => event.preventDefault()}>
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

            <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end">
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

        {task && (
          <div className="flex flex-col w-full md:w-[400px] lg:w-[450px] shrink-0 bg-slate-50/50 dark:bg-muted/10 border-t md:border-t-0 md:border-l border-border h-full max-h-[100dvh] overflow-hidden">
            <div className="flex items-center gap-2.5 p-6 pb-4 border-b border-border/50 bg-white/50 dark:bg-background/50">
              <div className="p-1.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                <MessageSquare className="h-4 w-4" />
              </div>
              <h3 className="text-[15px] font-semibold">Discussion</h3>
            </div>
            <div className="flex-1 min-h-0 relative px-6 pb-6 pt-4">
              <ClientSideSuspense fallback={<div className="text-xs text-muted-foreground py-12 flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/> Loading thread...</div>}>
                <TaskComments taskId={task.id} />
              </ClientSideSuspense>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function TaskComments({ taskId }: { taskId: number }) {
  const { threads } = useThreads({ query: { metadata: { taskId: String(taskId) } } });
  const createThread = useCreateThread();

  return (
    <div className="flex flex-col h-full gap-4">
      <ScrollArea className="flex-1 -mx-2 px-2">
        <div className="space-y-4 pb-4">
          {threads?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center shadow-sm border border-border mb-3">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">No comments yet</p>
              <p className="text-xs text-muted-foreground mt-1">Start the conversation!</p>
            </div>
          ) : (
            threads?.map((thread) => (
              <div key={thread.id} className="rounded-lg border border-border bg-white shadow-sm overflow-hidden transition-all hover:shadow-md">
                <Thread thread={thread} className="w-full" />
              </div>
            ))
          )}
        </div>
      </ScrollArea>
      
      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden shrink-0 transition-shadow focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500">
        <Composer
          onComposerSubmit={({ body, attachments }, event) => {
            event.preventDefault();
            createThread({
              body,
              attachments,
              metadata: { taskId: String(taskId) }
            });
          }}
          className="w-full"
        />
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

function ShareBoardDialog({
  board,
  onClose,
  onUpdateBoard,
}: {
  board: KanbanBoard;
  onClose: () => void;
  onUpdateBoard: (board: KanbanBoard) => void;
}) {
  const [email, setEmail] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { user } = useUser();
  const currentUserEmail = user?.primaryEmailAddress?.emailAddress;
  const isOwner = currentUserEmail === board.ownerEmail;

  const sharedEmails = board.sharedEmails ?? [];
  const pendingEmails = board.pendingEmails ?? [];

  async function handleShare(event: React.FormEvent) {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    
    if (!cleanEmail) return;
    if (sharedEmails.includes(cleanEmail)) {
      setError("This email is already shared with this board.");
      return;
    }
    if (pendingEmails.includes(cleanEmail)) {
      setError("This email is already invited.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/kanban/boards/${board.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const payload = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to share board");
      }
      
      onUpdateBoard(payload.board);
      setEmail("");
      toast.success("Board shared successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to share board");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveShare(emailToRemove: string) {
    setError(null);
    try {
      const response = await fetch(`/api/kanban/boards/${board.id}/share`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToRemove }),
      });
      const payload = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to remove share");
      }
      
      onUpdateBoard(payload.board);
      toast.success("Access removed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove access");
      toast.error("Unable to remove access");
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-4 shadow-soft">
        <DialogHeader title="Share Board" onClose={onClose} />
        
        <div className="mt-4">
          <p className="text-xs text-muted-foreground mb-3">
            Invite others to collaborate on "{board.name}" in real-time.
          </p>
          
          <form onSubmit={handleShare} className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring/30"
              placeholder="colleague@example.com"
            />
            <Button
              type="submit"
              className="h-9 rounded-lg bg-emerald-600 text-xs text-white hover:bg-emerald-700"
              disabled={saving || !email.trim() || !isOwner}
            >
              {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
              Invite
            </Button>
          </form>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          {!isOwner && <p className="mt-2 text-xs text-muted-foreground">Only the board owner can invite others.</p>}

          <div className="mt-6 space-y-4 max-h-48 overflow-y-auto">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">People with access</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-[10px] font-semibold text-background">
                      {board.ownerEmail ? board.ownerEmail.charAt(0).toUpperCase() : "O"}
                    </div>
                    <span className="text-sm font-medium">{board.ownerEmail || "Owner"}</span>
                  </div>
                  <span className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Owner</span>
                </div>
                
                {sharedEmails.map((sharedEmail: string) => (
                  <div key={sharedEmail} className="flex items-center justify-between rounded-lg border border-border bg-white px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[10px] font-semibold text-blue-700">
                        {sharedEmail.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm truncate max-w-[200px]" title={sharedEmail}>{sharedEmail}</span>
                    </div>
                    {(isOwner || sharedEmail === currentUserEmail) && (
                      <button
                        type="button"
                        onClick={() => void handleRemoveShare(sharedEmail)}
                        className="text-xs text-destructive hover:underline"
                      >
                        {isOwner ? "Remove" : "Leave Board"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {pendingEmails.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Pending invites</p>
                <div className="space-y-2">
                  {pendingEmails.map((pendingEmail: string) => (
                    <div key={pendingEmail} className="flex items-center justify-between rounded-lg border border-border bg-muted/10 px-3 py-2 opacity-75">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-[10px] font-semibold text-amber-700">
                          {pendingEmail.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm truncate max-w-[200px]" title={pendingEmail}>{pendingEmail}</span>
                      </div>
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => void handleRemoveShare(pendingEmail)}
                          className="text-xs text-destructive hover:underline"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}