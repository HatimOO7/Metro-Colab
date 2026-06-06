"use client";

import * as React from "react";

import {
  isRenderableScheduledItem,
  mapApiCalendarItem,
  mapApiCalendarItems,
  normalizeCalendarDateKey,
  type ClientCalendarItem,
} from "@/lib/calendar-items";

export type CalendarItem = ClientCalendarItem;

export type KanbanLabel = {
  name: string;
  color: string;
};

export type KanbanTask = {
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

export type KanbanColumn = {
  id: number;
  boardId: number;
  name: string;
  position: number;
  tasks: KanbanTask[];
};

export type KanbanBoard = {
  id: number;
  userId: number;
  name: string;
  color: string;
  columns: KanbanColumn[];
  sharedEmails?: string[];
};

export type KanbanSearchResult = {
  board: KanbanBoard;
  column: KanbanColumn;
  task: KanbanTask;
};

export type PendingKanbanTaskEdit = {
  boardId: number;
  columnId: number;
  taskId: number;
};

type WorkspaceDataContextValue = {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  createBoardRequested: boolean;
  requestCreateBoard: () => void;
  clearCreateBoardRequest: () => void;
  pendingKanbanTaskEdit: PendingKanbanTaskEdit | null;
  requestKanbanTaskEdit: (edit: PendingKanbanTaskEdit) => void;
  clearKanbanTaskEditRequest: () => void;
  pendingCalendarItemEdit: number | null;
  requestCalendarItemEdit: (itemId: number) => void;
  clearCalendarItemEditRequest: () => void;
  calendarItems: CalendarItem[];
  calendarLoading: boolean;
  calendarReady: boolean;
  calendarError: string | null;
  createCalendarItem: (input: Omit<CalendarItem, "id">) => Promise<CalendarItem>;
  updateCalendarItem: (
    id: number,
    input: Partial<CalendarItem>,
    options?: { optimistic?: boolean }
  ) => Promise<CalendarItem>;
  deleteCalendarItem: (id: number) => Promise<void>;
  upsertCalendarItem: (item: CalendarItem) => void;
  removeCalendarItem: (id: number) => void;
  reloadCalendarItems: (options?: { silent?: boolean }) => Promise<void>;
  kanbanBoards: KanbanBoard[];
  kanbanLoading: boolean;
  kanbanReady: boolean;
  kanbanError: string | null;
  setKanbanBoards: React.Dispatch<React.SetStateAction<KanbanBoard[]>>;
  patchKanbanTask: (taskId: number, patch: Partial<KanbanTask>) => void;
  reloadKanbanBoards: (options?: { silent?: boolean }) => Promise<void>;
};

const WorkspaceDataContext = React.createContext<WorkspaceDataContextValue | null>(null);

async function readJson(response: Response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed");
  }

  return payload;
}

type WorkspaceDataProviderProps = {
  children: React.ReactNode;
  onNavigateToKanban?: () => void;
  onNavigateToCalendar?: () => void;
};

export function WorkspaceDataProvider({
  children,
  onNavigateToKanban,
  onNavigateToCalendar,
}: WorkspaceDataProviderProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [createBoardRequested, setCreateBoardRequested] = React.useState(false);
  const [pendingKanbanTaskEdit, setPendingKanbanTaskEdit] = React.useState<PendingKanbanTaskEdit | null>(null);
  const [pendingCalendarItemEdit, setPendingCalendarItemEdit] = React.useState<number | null>(null);

  const [calendarItems, setCalendarItems] = React.useState<CalendarItem[]>([]);
  const [calendarLoading, setCalendarLoading] = React.useState(false);
  const [calendarReady, setCalendarReady] = React.useState(false);
  const [calendarError, setCalendarError] = React.useState<string | null>(null);

  const [kanbanBoards, setKanbanBoards] = React.useState<KanbanBoard[]>([]);
  const [kanbanLoading, setKanbanLoading] = React.useState(false);
  const [kanbanReady, setKanbanReady] = React.useState(false);
  const [kanbanError, setKanbanError] = React.useState<string | null>(null);
  const calendarReadyRef = React.useRef(false);
  const kanbanReadyRef = React.useRef(false);

  const reloadCalendarItems = React.useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (!silent && !calendarReadyRef.current) {
      setCalendarLoading(true);
    }

    setCalendarError(null);

    try {
      const response = await fetch("/api/calendar-items", { cache: "no-store" });
      const payload = await readJson(response);
      setCalendarItems(mapApiCalendarItems(payload.items));
      calendarReadyRef.current = true;
      setCalendarReady(true);
    } catch (fetchError) {
      setCalendarError(fetchError instanceof Error ? fetchError.message : "Unable to load calendar items");
    } finally {
      setCalendarLoading(false);
    }
  }, []);

  const reloadKanbanBoards = React.useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (!silent && !kanbanReadyRef.current) {
      setKanbanLoading(true);
    }

    setKanbanError(null);

    try {
      const response = await fetch("/api/kanban/boards", { cache: "no-store" });
      const payload = await readJson(response);
      setKanbanBoards(payload.boards ?? []);
      kanbanReadyRef.current = true;
      setKanbanReady(true);
    } catch (fetchError) {
      setKanbanError(fetchError instanceof Error ? fetchError.message : "Unable to load boards.");
    } finally {
      setKanbanLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reloadCalendarItems();
    void reloadKanbanBoards();
  }, [reloadCalendarItems, reloadKanbanBoards]);

  const createCalendarItem = React.useCallback(async (input: Omit<CalendarItem, "id">) => {
    const response = await fetch("/api/calendar-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = await readJson(response);
    const item = mapApiCalendarItem(payload.item);

    if (!item) {
      throw new Error("Failed to parse created calendar item");
    }

    setCalendarItems((currentItems) => [...currentItems, item]);
    return item;
  }, []);

  const upsertCalendarItem = React.useCallback((item: CalendarItem) => {
    const normalizedItem: CalendarItem = {
      ...item,
      scheduledDate: normalizeCalendarDateKey(item.scheduledDate),
      status: item.status === "draft" ? "draft" : "scheduled",
      itemType: item.itemType === "reminder" ? "reminder" : "task",
    };

    setCalendarItems((currentItems) => {
      const exists = currentItems.some((currentItem) => currentItem.id === normalizedItem.id);

      if (!exists) {
        return [...currentItems, normalizedItem];
      }

      return currentItems.map((currentItem) =>
        currentItem.id === normalizedItem.id ? normalizedItem : currentItem
      );
    });
  }, []);

  const removeCalendarItem = React.useCallback((id: number) => {
    setCalendarItems((currentItems) => currentItems.filter((item) => item.id !== id));
  }, []);

  const patchKanbanTask = React.useCallback((taskId: number, patch: Partial<KanbanTask>) => {
    setKanbanBoards((currentBoards) =>
      currentBoards.map((board) => ({
        ...board,
        columns: board.columns.map((column) => ({
          ...column,
          tasks: column.tasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task)),
        })),
      }))
    );
  }, []);

  const updateCalendarItem = React.useCallback(
    async (id: number, input: Partial<CalendarItem>, options?: { optimistic?: boolean }) => {
      let previousItems: CalendarItem[] | null = null;

      if (options?.optimistic) {
        setCalendarItems((currentItems) => {
          previousItems = currentItems;
          return currentItems.map((item) => (item.id === id ? { ...item, ...input } : item));
        });
      }

      try {
        const response = await fetch(`/api/calendar-items/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const payload = await readJson(response);
        const item = mapApiCalendarItem(payload.item);

        if (!item) {
          throw new Error("Failed to parse updated calendar item");
        }

        setCalendarItems((currentItems) => currentItems.map((currentItem) => (currentItem.id === id ? item : currentItem)));

        if (payload.linkedKanbanTask) {
          patchKanbanTask(payload.linkedKanbanTask.id, payload.linkedKanbanTask);
        }

        void reloadKanbanBoards({ silent: true });

        return item;
      } catch (updateError) {
        if (previousItems) {
          setCalendarItems(previousItems);
        }

        throw updateError;
      }
    },
    [patchKanbanTask, reloadKanbanBoards]
  );

  const deleteCalendarItem = React.useCallback(async (id: number) => {
    const response = await fetch(`/api/calendar-items/${id}`, { method: "DELETE" });
    await readJson(response);
    setCalendarItems((currentItems) => currentItems.filter((item) => item.id !== id));
  }, []);

  const requestCreateBoard = React.useCallback(() => {
    setCreateBoardRequested(true);
  }, []);

  const clearCreateBoardRequest = React.useCallback(() => {
    setCreateBoardRequested(false);
  }, []);

  const requestKanbanTaskEdit = React.useCallback(
    (edit: PendingKanbanTaskEdit) => {
      onNavigateToKanban?.();
      setPendingKanbanTaskEdit(edit);
    },
    [onNavigateToKanban]
  );

  const clearKanbanTaskEditRequest = React.useCallback(() => {
    setPendingKanbanTaskEdit(null);
  }, []);

  const requestCalendarItemEdit = React.useCallback(
    (itemId: number) => {
      onNavigateToCalendar?.();
      setPendingCalendarItemEdit(itemId);
    },
    [onNavigateToCalendar]
  );

  const clearCalendarItemEditRequest = React.useCallback(() => {
    setPendingCalendarItemEdit(null);
  }, []);

  const value = React.useMemo(
    () => ({
      searchQuery,
      setSearchQuery,
      createBoardRequested,
      requestCreateBoard,
      clearCreateBoardRequest,
      pendingKanbanTaskEdit,
      requestKanbanTaskEdit,
      clearKanbanTaskEditRequest,
      pendingCalendarItemEdit,
      requestCalendarItemEdit,
      clearCalendarItemEditRequest,
      calendarItems,
      calendarLoading,
      calendarReady,
      calendarError,
      createCalendarItem,
      updateCalendarItem,
      deleteCalendarItem,
      upsertCalendarItem,
      removeCalendarItem,
      reloadCalendarItems,
      kanbanBoards,
      kanbanLoading,
      kanbanReady,
      kanbanError,
      setKanbanBoards,
      patchKanbanTask,
      reloadKanbanBoards,
    }),
    [
      searchQuery,
      createBoardRequested,
      requestCreateBoard,
      clearCreateBoardRequest,
      pendingKanbanTaskEdit,
      requestKanbanTaskEdit,
      clearKanbanTaskEditRequest,
      pendingCalendarItemEdit,
      requestCalendarItemEdit,
      clearCalendarItemEditRequest,
      calendarItems,
      calendarLoading,
      calendarReady,
      calendarError,
      createCalendarItem,
      updateCalendarItem,
      deleteCalendarItem,
      upsertCalendarItem,
      removeCalendarItem,
      reloadCalendarItems,
      kanbanBoards,
      kanbanLoading,
      kanbanReady,
      kanbanError,
      patchKanbanTask,
      reloadKanbanBoards,
    ]
  );

  return <WorkspaceDataContext.Provider value={value}>{children}</WorkspaceDataContext.Provider>;
}

export function useWorkspaceData() {
  const context = React.useContext(WorkspaceDataContext);

  if (!context) {
    throw new Error("useWorkspaceData must be used within WorkspaceDataProvider");
  }

  return context;
}

export function matchesSearch(query: string, ...fields: Array<string | null | undefined>) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return fields.some((field) => field?.toLowerCase().includes(normalized));
}

export function filterKanbanBoards(boards: KanbanBoard[], query: string): KanbanBoard[] {
  if (!query.trim()) {
    return boards;
  }

  return boards
    .map((board) => {
      const boardMatches = matchesSearch(query, board.name);
      const filteredColumns = board.columns.map((column) => ({
        ...column,
        tasks: column.tasks.filter((task) =>
          boardMatches || matchesSearch(query, task.title, task.description)
        ),
      }));

      const hasVisibleTasks = filteredColumns.some((column) => column.tasks.length > 0);

      if (!boardMatches && !hasVisibleTasks) {
        return null;
      }

      return { ...board, columns: filteredColumns };
    })
    .filter((board): board is KanbanBoard => Boolean(board));
}

export function filterCalendarItems(items: CalendarItem[], query: string) {
  if (!query.trim()) {
    return items;
  }

  return items.filter((item) =>
    matchesSearch(query, item.title, item.description, item.category)
  );
}

export function collectKanbanSearchResults(boards: KanbanBoard[], query: string): KanbanSearchResult[] {
  if (!query.trim()) {
    return [];
  }

  const results: KanbanSearchResult[] = [];

  for (const board of boards) {
    for (const column of board.columns) {
      for (const task of column.tasks) {
        if (matchesSearch(query, board.name, task.title, task.description)) {
          results.push({ board, column, task });
        }
      }
    }
  }

  return results;
}

export function mapApiCalendarItemFromPayload(item: unknown): CalendarItem | null {
  return mapApiCalendarItem(item);
}

export { isRenderableScheduledItem, normalizeCalendarDateKey };
