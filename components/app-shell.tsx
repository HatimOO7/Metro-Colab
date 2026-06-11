"use client";

import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  GripVertical,
  LayoutDashboard,
  Layers3,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  Pin,
  Plus,
  Search,
  Settings,
  Sparkles,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { DashboardPage, SettingsPage } from "@/components/dashboard-page";
import { KanbanBoardPage } from "@/components/kanban-board";
import { NotesPage } from "@/components/notes-page";
import { IncomingCallProvider } from "@/components/whiteboard/incoming-call-provider";
import { WhiteboardPage } from "@/components/whiteboard-page";
import { PagesSpacesPage } from "@/components/pages-spaces";
import { AiTemplateBuilderPage } from "@/components/ai-template-builder";
import { AppIcon, AppPreviewRenderer } from "@/components/ai-template-preview";
import {
  collectKanbanSearchResults,
  filterCalendarItems,
  isRenderableScheduledItem,
  normalizeCalendarDateKey,
  useWorkspaceData,
  WorkspaceDataProvider,
  type CalendarItem,
} from "@/components/workspace-data";
import { cn } from "@/lib/utils";

type PinnedApp = {
  id: number;
  appName: string;
  icon: string;
  color: string;
};

type MenuItem = {
  label: string;
  icon: React.ElementType;
  color: string;
};

type CalendarForm = {
  title: string;
  description: string;
  itemType: "task" | "reminder";
  category: string;
  scheduledTime: string;
};

type Category = {
  name: string;
  color: string;
  swatch: string;
  badge: string;
  border: string;
};

const menuGroups: { label: string; items: MenuItem[] }[] = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, color: "text-coral-600" },
      { label: "Calendar", icon: CalendarDays, color: "text-sky-600" },
      { label: "Task / Kanban", icon: ClipboardCheck, color: "text-emerald-600" },
      { label: "Settings", icon: Settings, color: "text-slate-600" },
    ],
  },
  {
    label: "Create",
    items: [
      { label: "Notes", icon: StickyNote, color: "text-amber-600" },
      { label: "Whiteboard", icon: PenLine, color: "text-fuchsia-600" },
      { label: "Pages / Spaces", icon: Layers3, color: "text-indigo-600" },
      { label: "AI Template Builder", icon: Sparkles, color: "text-orange-600" },
    ],
  },
];

const categories: Category[] = [
  {
    name: "Work",
    color: "sky",
    swatch: "bg-sky-500",
    badge: "bg-sky-100 text-sky-700",
    border: "border-l-sky-500",
  },
  {
    name: "Personal",
    color: "coral",
    swatch: "bg-coral-600",
    badge: "bg-coral-100 text-coral-700",
    border: "border-l-coral-600",
  },
  {
    name: "Reminder",
    color: "amber",
    swatch: "bg-amber-500",
    badge: "bg-amber-100 text-amber-700",
    border: "border-l-amber-500",
  },
  {
    name: "Meeting",
    color: "emerald",
    swatch: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-700",
    border: "border-l-emerald-500",
  },
  {
    name: "Focus",
    color: "violet",
    swatch: "bg-violet-500",
    badge: "bg-violet-100 text-violet-700",
    border: "border-l-violet-500",
  },
  {
    name: "Urgent",
    color: "fuchsia",
    swatch: "bg-fuchsia-500",
    badge: "bg-fuchsia-100 text-fuchsia-700",
    border: "border-l-fuchsia-500",
  },
];

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const defaultForm: CalendarForm = {
  title: "",
  description: "",
  itemType: "task",
  category: "Work",
  scheduledTime: "",
};

function itemToForm(item: CalendarItem): CalendarForm {
  return {
    title: item.title,
    description: item.description ?? "",
    itemType: item.itemType,
    category: item.category,
    scheduledTime: item.scheduledTime ?? "",
  };
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(date: Date, amount: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

function startOfWeek(date: Date) {
  return addDays(date, -date.getDay());
}

function getMonthDates(anchorDate: Date) {
  const firstOfMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const firstGridDate = startOfWeek(firstOfMonth);
  const lastOfMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);
  const lastGridDate = addDays(lastOfMonth, 6 - lastOfMonth.getDay());
  const dates: Date[] = [];
  let cursor = firstGridDate;

  while (cursor <= lastGridDate) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return dates;
}

function getWeekDates(anchorDate: Date) {
  const firstDate = startOfWeek(anchorDate);
  return Array.from({ length: 7 }, (_, index) => addDays(firstDate, index));
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date);
}

function formatDateLabel(dateKey: string | null) {
  if (!dateKey) {
    return "No date";
  }

  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(year, month - 1, day)
  );
}

function getCategory(name: string) {
  return categories.find((category) => category.name === name) ?? categories[0];
}

export function AppShell() {
  const [activeItem, setActiveItem] = React.useState("Dashboard");

  return (
    <WorkspaceDataProvider
      onNavigateToKanban={() => setActiveItem("Task / Kanban")}
      onNavigateToCalendar={() => setActiveItem("Calendar")}
    >
      <IncomingCallProvider onNavigateToWhiteboard={() => setActiveItem("Whiteboard")}>
        <AppShellContent activeItem={activeItem} setActiveItem={setActiveItem} />
      </IncomingCallProvider>
    </WorkspaceDataProvider>
  );
}

function AppShellContent({
  activeItem,
  setActiveItem,
}: {
  activeItem: string;
  setActiveItem: React.Dispatch<React.SetStateAction<string>>;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const { requestCreateBoard } = useWorkspaceData();
  const [calendarCreateReminderRequested, setCalendarCreateReminderRequested] = React.useState(false);
  const isCalendar = activeItem === "Calendar";
  const isKanban = activeItem === "Task / Kanban";
  const isWhiteboard = activeItem === "Whiteboard";
  const isPagesSpaces = activeItem === "Pages / Spaces";
  const isAiBuilder = activeItem === "AI Template Builder";
  const isSettings = activeItem === "Settings";

  // Pinned AI apps for sidebar
  const [pinnedApps, setPinnedApps] = React.useState<PinnedApp[]>([]);
  const [activeAppTemplateId, setActiveAppTemplateId] = React.useState<number | null>(null);

  const loadPinnedApps = React.useCallback(async () => {
    try {
      const res = await fetch("/api/ai-templates/sidebar");
      if (!res.ok) return;
      const data = (await res.json()) as { pins: (PinnedApp & { appJson: { icon: string; color: string } })[] };
      setPinnedApps(
        data.pins.map((p) => ({
          id: p.id,
          appName: p.appName,
          icon: p.appJson?.icon ?? p.icon,
          color: p.appJson?.color ?? p.color,
        }))
      );
    } catch {
      // silently ignore sidebar load errors
    }
  }, []);

  React.useEffect(() => {
    void loadPinnedApps();
  }, [loadPinnedApps]);

  // Reload pins whenever user leaves the builder page
  const prevActiveItem = React.useRef(activeItem);
  React.useEffect(() => {
    if (prevActiveItem.current === "AI Template Builder" && activeItem !== "AI Template Builder") {
      void loadPinnedApps();
    }
    prevActiveItem.current = activeItem;
  }, [activeItem, loadPinnedApps]);

  const handleNewSpace = () => {
    setActiveItem("Task / Kanban");
    requestCreateBoard();
  };

  const handleCreateTask = () => {
    setActiveItem("Task / Kanban");
    requestCreateBoard();
  };

  const handleCreateNote = React.useCallback(async () => {
    const response = await fetch("/api/notes", { method: "POST" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error ?? "Unable to create note");
    }
    setActiveItem("Notes");
  }, [setActiveItem]);

  const handleCreateReminder = () => {
    setActiveItem("Calendar");
    setCalendarCreateReminderRequested(true);
  };

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <div className="flex h-full flex-col md:flex-row">
        <aside
          className={cn(
            "flex shrink-0 flex-col border-b border-border bg-sidebar px-2.5 py-3 transition-all duration-300 md:h-full md:border-b-0 md:border-r",
            collapsed ? "md:w-[68px]" : "md:w-[224px]"
          )}
        >
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex min-w-0 items-center gap-2">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white shadow-soft [background:var(--primary-gradient)]">
                <Layers3 className="h-4 w-4" aria-hidden="true" />
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold leading-5">Metro Colab</p>
                  <p className="truncate text-[10px] text-muted-foreground">Think, plan, create</p>
                </div>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden h-8 w-8 rounded-lg md:inline-flex"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
            </Button>
          </div>

          <nav className="mt-4 flex flex-1 flex-col gap-3 overflow-y-auto pr-1" aria-label="Primary navigation">
            {menuGroups.map((group) => (
              <div key={group.label}>
                {!collapsed && (
                  <p className="mb-1 px-2 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    {group.label}
                  </p>
                )}
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = activeItem === item.label;

                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          setActiveItem(item.label);
                          setActiveAppTemplateId(null);
                        }}
                        className={cn(
                          "flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[11px] font-semibold transition",
                          collapsed && "justify-center px-0",
                          active
                            ? "bg-sidebar-active text-foreground shadow-soft ring-1 ring-white/70"
                            : "text-muted-foreground hover:bg-white/75 hover:text-foreground"
                        )}
                        aria-label={item.label}
                        title={item.label}
                      >
                        <Icon className={cn("h-3.5 w-3.5 shrink-0", item.color)} aria-hidden="true" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Pinned AI Apps section */}
            {pinnedApps.length > 0 && (
              <div>
                {!collapsed && (
                  <p className="mb-1 px-2 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    My Apps
                  </p>
                )}
                <div className="space-y-1">
                  {pinnedApps.map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => {
                        setActiveAppTemplateId(app.id);
                        setActiveItem(`app-${app.id}`);
                      }}
                      className={cn(
                        "flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[11px] font-semibold transition",
                        collapsed && "justify-center px-0",
                        activeItem === `app-${app.id}`
                          ? "bg-sidebar-active text-foreground shadow-soft ring-1 ring-white/70"
                          : "text-muted-foreground hover:bg-white/75 hover:text-foreground"
                      )}
                      title={app.appName}
                    >
                      <span
                        className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm"
                        style={{ backgroundColor: `${app.color}28` }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: app.color }} />
                      </span>
                      {!collapsed && <span className="truncate">{app.appName}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </nav>
        </aside>

        <section className={cn("flex min-w-0 flex-1 flex-col overflow-y-auto", isWhiteboard && "overflow-hidden", isPagesSpaces && "overflow-hidden")}>
          {activeItem !== "Notes" && !isWhiteboard && !isPagesSpaces && !isAiBuilder && !activeAppTemplateId && <AppHeader activeItem={activeItem} onNewSpace={handleNewSpace} />}
          {activeAppTemplateId ? (
            <ActiveAppContainer
              templateId={activeAppTemplateId}
              onBack={() => {
                setActiveAppTemplateId(null);
                setActiveItem("Dashboard");
              }}
            />
          ) : isCalendar ? (
            <CalendarPlanner
              createReminderRequested={calendarCreateReminderRequested}
              onCreateReminderConsumed={() => setCalendarCreateReminderRequested(false)}
            />
          ) : isKanban ? (
            <KanbanBoardPage />
          ) : activeItem === "Notes" ? (
            <NotesPage />
          ) : isWhiteboard ? (
            <WhiteboardPage />
          ) : isPagesSpaces ? (
            <PagesSpacesPage />
          ) : isAiBuilder ? (
            <AiTemplateBuilderPage
              onOpenTemplate={(id) => {
                setActiveAppTemplateId(id);
                setActiveItem(`app-${id}`);
              }}
            />
          ) : isSettings ? (
            <SettingsPage />
          ) : (
            <DashboardPage
              onCreateTask={handleCreateTask}
              onCreateNote={handleCreateNote}
              onCreateReminder={handleCreateReminder}
              onOpenWhiteboard={() => setActiveItem("Whiteboard")}
              onCreateTemplate={() => setActiveItem("AI Template Builder")}
            />
          )}
        </section>
      </div>
    </main>
  );
}

// ── Active App Container ───────────────────────────────────────────────────────

function ActiveAppContainer({
  templateId,
  onBack,
}: {
  templateId: number;
  onBack: () => void;
}) {
  const [template, setTemplate] = React.useState<{ appJson: import("@/db/schema").AiTemplateJson; appName: string; icon: string; color: string } | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    fetch(`/api/ai-templates/${templateId}`)
      .then((r) => r.json())
      .then((d: any) => {
        if (d.template) setTemplate(d.template);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [templateId]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">App not found</p>
        <Button onClick={onBack}>Go Back</Button>
      </div>
    );
  }

  return (
    <AppPreviewRenderer
      appJson={template.appJson}
      templateId={templateId}
      onBack={onBack}
    />
  );
}

function AppHeader({ activeItem, onNewSpace }: { activeItem: string; onNewSpace: () => void }) {
  const isCalendar = activeItem === "Calendar";
  const isKanban = activeItem === "Task / Kanban";
  const {
    searchQuery,
    setSearchQuery,
    kanbanBoards,
    calendarItems,
    requestKanbanTaskEdit,
    requestCalendarItemEdit,
  } = useWorkspaceData();
  const [searchFocused, setSearchFocused] = React.useState(false);
  const searchContainerRef = React.useRef<HTMLDivElement>(null);

  const kanbanResults = React.useMemo(
    () => collectKanbanSearchResults(kanbanBoards, searchQuery),
    [kanbanBoards, searchQuery]
  );
  const calendarResults = React.useMemo(
    () => filterCalendarItems(calendarItems, searchQuery),
    [calendarItems, searchQuery]
  );
  const showSearchResults =
    searchQuery.trim().length > 0 && (searchFocused || kanbanResults.length > 0 || calendarResults.length > 0);

  React.useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!searchContainerRef.current?.contains(event.target as Node)) {
        setSearchFocused(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <header className="flex flex-col gap-3 border-b border-border bg-background/85 px-4 py-4 backdrop-blur md:flex-row md:items-center md:justify-between lg:px-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {isCalendar ? "Calendar Studio" : isKanban ? "Task Board" : "Productivity Hub"}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground md:text-3xl">
          {isCalendar
            ? "Shape the month, one task at a time."
            : isKanban
              ? "Move work from idea to done."
              : "Build the week with clarity."}
        </h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div ref={searchContainerRef} className="relative min-w-[190px] flex-1 sm:flex-none">
          <label className="flex h-9 items-center gap-2 rounded-lg border border-border bg-white px-3 text-xs text-muted-foreground shadow-soft">
            <Search className="h-4 w-4 shrink-0 text-sky-600" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onFocus={() => setSearchFocused(true)}
              placeholder="Search pages, boards, tasks"
              className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
              aria-label="Search pages, boards, tasks"
              aria-expanded={showSearchResults}
              aria-controls="workspace-search-results"
            />
          </label>

          {showSearchResults && (
            <div
              id="workspace-search-results"
              className="absolute right-0 top-[calc(100%+0.5rem)] z-40 max-h-80 w-[min(100vw-2rem,360px)] overflow-y-auto rounded-lg border border-border bg-white p-2 shadow-soft"
            >
              {kanbanResults.length === 0 && calendarResults.length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted-foreground">No matching boards, tasks, or calendar items.</p>
              ) : (
                <div className="space-y-3">
                  {kanbanResults.length > 0 && (
                    <div>
                      <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                        Kanban tasks
                      </p>
                      <div className="space-y-1">
                        {kanbanResults.map(({ board, column, task }) => (
                          <button
                            key={`kanban-${task.id}`}
                            type="button"
                            onClick={() => {
                              requestKanbanTaskEdit({
                                boardId: board.id,
                                columnId: column.id,
                                taskId: task.id,
                              });
                              setSearchFocused(false);
                            }}
                            className="flex w-full min-w-0 items-start gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-emerald-50"
                          >
                            <ClipboardCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-semibold text-foreground">{task.title}</span>
                              <span className="block truncate text-[10px] text-muted-foreground">
                                {board.name} · {column.name}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {calendarResults.length > 0 && (
                    <div>
                      <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                        Calendar items
                      </p>
                      <div className="space-y-1">
                        {calendarResults.map((item) => (
                          <button
                            key={`calendar-${item.id}`}
                            type="button"
                            onClick={() => {
                              requestCalendarItemEdit(item.id);
                              setSearchFocused(false);
                            }}
                            className="flex w-full min-w-0 items-start gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-sky-50"
                          >
                            <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" aria-hidden="true" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-semibold text-foreground">{item.title}</span>
                              <span className="block truncate text-[10px] text-muted-foreground">
                                {item.scheduledDate ? formatDateLabel(item.scheduledDate) : "Draft"} · {item.category}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <Button
          type="button"
          className="h-9 rounded-lg bg-foreground text-xs text-background hover:bg-foreground/90"
          onClick={onNewSpace}
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          New space
        </Button>
      </div>
    </header>
  );
}

function CalendarPlanner({
  createReminderRequested,
  onCreateReminderConsumed,
}: {
  createReminderRequested: boolean;
  onCreateReminderConsumed: () => void;
}) {
  const today = React.useMemo(() => new Date(), []);
  const [view, setView] = React.useState<"month" | "week">("month");
  const [anchorDate, setAnchorDate] = React.useState(today);
  const [dialogDate, setDialogDate] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<CalendarItem | null>(null);
  const [newItemType, setNewItemType] = React.useState<CalendarForm["itemType"]>("task");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const {
    searchQuery,
    calendarItems,
    calendarLoading,
    calendarReady,
    calendarError,
    createCalendarItem,
    updateCalendarItem,
    deleteCalendarItem,
    reloadCalendarItems,
    pendingCalendarItemEdit,
    clearCalendarItemEditRequest,
  } = useWorkspaceData();

  const filteredItems = React.useMemo(
    () => filterCalendarItems(calendarItems, searchQuery),
    [calendarItems, searchQuery]
  );
  const loading = calendarLoading && !calendarReady;
  const error = calendarError;

  const visibleDates = view === "month" ? getMonthDates(anchorDate) : getWeekDates(anchorDate);
  const scheduledItems = filteredItems.filter((item) => isRenderableScheduledItem(item));
  const draftItems = filteredItems.filter((item) => item.status === "draft");

  const itemsByDate = React.useMemo(() => {
    return scheduledItems.reduce<Record<string, CalendarItem[]>>((accumulator, item) => {
      const dateKey = normalizeCalendarDateKey(item.scheduledDate);

      if (!dateKey) {
        return accumulator;
      }

      accumulator[dateKey] = [...(accumulator[dateKey] ?? []), { ...item, scheduledDate: dateKey }];
      return accumulator;
    }, {});
  }, [scheduledItems]);

  function openDialog(dateKey: string | null, itemType: CalendarForm["itemType"] = "task") {
    setDialogDate(dateKey);
    setEditingItem(null);
    setNewItemType(itemType);
    setFormError(null);
    setActionError(null);
    setDialogOpen(true);
  }

  function openEditDialog(item: CalendarItem) {
    setDialogDate(item.scheduledDate);
    setEditingItem(item);
    setNewItemType(item.itemType);
    setFormError(null);
    setActionError(null);
    setDialogOpen(true);
  }

  React.useEffect(() => {
    if (!createReminderRequested) {
      return;
    }

    openDialog(toDateKey(today), "reminder");
    onCreateReminderConsumed();
  }, [createReminderRequested, onCreateReminderConsumed, today]);

  React.useEffect(() => {
    if (!pendingCalendarItemEdit || !calendarReady) {
      return;
    }

    const item = calendarItems.find((currentItem) => currentItem.id === pendingCalendarItemEdit);

    if (!item) {
      return;
    }

    openEditDialog(item);
    clearCalendarItemEditRequest();
  }, [calendarItems, calendarReady, clearCalendarItemEditRequest, pendingCalendarItemEdit]);

  function handleNavigate(direction: -1 | 1) {
    setAnchorDate((currentDate) => {
      if (view === "week") {
        return addDays(currentDate, direction * 7);
      }

      return new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1);
    });
  }

  async function handleSave(form: CalendarForm, status: "scheduled" | "draft") {
    const category = getCategory(form.category);

    if (!form.title.trim()) {
      setFormError("Add a title before saving.");
      return;
    }

    if (status === "scheduled" && !dialogDate) {
      setFormError("Choose a calendar date before scheduling.");
      return;
    }

    setSaving(true);
    setFormError(null);
    setActionError(null);

    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        itemType: form.itemType,
        category: category.name,
        categoryColor: category.color,
        scheduledDate: status === "scheduled" ? dialogDate : null,
        scheduledTime: form.scheduledTime || null,
        status,
      };

      if (editingItem) {
        await updateCalendarItem(editingItem.id, payload);
      } else {
        await createCalendarItem(payload);
      }

      setDialogOpen(false);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Unable to save item.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDrop(dateKey: string, event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const itemId = Number(
      event.dataTransfer.getData("text/calendar-item-id") || event.dataTransfer.getData("text/plain")
    );

    if (!Number.isInteger(itemId)) {
      return;
    }

    setActionError(null);

    try {
      await updateCalendarItem(itemId, {
        scheduledDate: dateKey,
        status: "scheduled",
      }, { optimistic: true });
    } catch (dropError) {
      setActionError(dropError instanceof Error ? dropError.message : "Unable to reschedule item.");
    }
  }

  async function handleDelete(id: number) {
    setActionError(null);

    try {
      await deleteCalendarItem(id);
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : "Unable to delete item.");
    }
  }

  return (
    <div className="grid min-h-0 gap-4 px-4 py-5 xl:grid-cols-[minmax(0,1fr)_320px] lg:px-6">
      <section className="min-w-0 rounded-lg border border-border bg-card p-3 shadow-soft sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {view === "month" ? "Month View" : "Week View"}
            </p>
            <h2 className="mt-1 truncate text-xl font-semibold md:text-2xl">{formatMonthLabel(anchorDate)}</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="grid h-9 grid-cols-2 rounded-lg border border-border bg-white p-1 text-xs shadow-soft">
              <button
                type="button"
                onClick={() => setView("month")}
                className={cn("rounded-md px-3 font-semibold transition", view === "month" && "bg-sky-100 text-sky-700")}
              >
                Month
              </button>
              <button
                type="button"
                onClick={() => setView("week")}
                className={cn("rounded-md px-3 font-semibold transition", view === "week" && "bg-sky-100 text-sky-700")}
              >
                Week
              </button>
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-lg bg-white"
              onClick={() => handleNavigate(-1)}
              aria-label={view === "month" ? "Previous month" : "Previous week"}
              title={view === "month" ? "Previous month" : "Previous week"}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-lg bg-white"
              onClick={() => handleNavigate(1)}
              aria-label={view === "month" ? "Next month" : "Next week"}
              title={view === "month" ? "Next month" : "Next week"}
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              className="h-9 rounded-lg bg-foreground text-xs text-background hover:bg-foreground/90"
              onClick={() => openDialog(toDateKey(today))}
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              New task
            </Button>
          </div>
        </div>

        {(error || actionError) && (
          <div className="mt-3 rounded-lg border border-destructive/25 bg-red-50 px-3 py-2 text-sm text-destructive">
            {error ?? actionError}
            {error && (
              <button type="button" className="ml-2 font-semibold underline" onClick={() => void reloadCalendarItems()}>
                Retry
              </button>
            )}
          </div>
        )}

        <div className="mt-4 overflow-hidden rounded-lg border border-border bg-white">
          <div className="grid grid-cols-7 border-b border-border bg-muted/60">
            {weekDays.map((day) => (
              <div key={day} className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7" data-testid="calendar-grid">
            {visibleDates.map((date) => {
              const dateKey = toDateKey(date);
              const dayItems = itemsByDate[dateKey] ?? [];
              const isCurrentMonth = date.getMonth() === anchorDate.getMonth();
              const isToday = dateKey === toDateKey(today);

              return (
                <div
                  key={dateKey}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => void handleDrop(dateKey, event)}
                  className={cn(
                    "min-h-[136px] min-w-0 border-b border-r border-border/80 p-2 transition hover:bg-sky-50/60",
                    view === "week" && "min-h-[420px]",
                    !isCurrentMonth && view === "month" && "bg-muted/30 text-muted-foreground"
                  )}
                  data-testid={`calendar-day-${dateKey}`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => openDialog(dateKey)}
                      className={cn(
                        "grid h-7 w-7 place-items-center rounded-lg text-xs font-semibold transition hover:bg-sky-100 hover:text-sky-700",
                        isToday && "bg-foreground text-background hover:bg-foreground hover:text-background"
                      )}
                      aria-label={`Add item on ${formatDateLabel(dateKey)}`}
                    >
                      {date.getDate()}
                    </button>
                    <button
                      type="button"
                      onClick={() => openDialog(dateKey)}
                      className="grid h-6 w-6 place-items-center rounded-lg text-muted-foreground transition hover:bg-sky-100 hover:text-sky-700"
                      aria-label={`Create task for ${formatDateLabel(dateKey)}`}
                      title="Create task"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="mt-2 flex max-h-[80px] flex-col gap-1 overflow-y-auto">
                    {loading ? (
                      <>
                        <div className="h-5 animate-pulse rounded-md bg-muted" />
                        <div className="h-5 animate-pulse rounded-md bg-muted" />
                      </>
                    ) : (
                      dayItems.map((item) => (
                        <CalendarTaskChip
                          key={item.id}
                          item={item}
                          onOpen={() => openEditDialog(item)}
                          onDelete={() => void handleDelete(item.id)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <DraftTaskPanel
        drafts={draftItems}
        loading={loading}
        onCreateDraft={() => openDialog(null)}
        onOpen={openEditDialog}
        onDelete={(id) => void handleDelete(id)}
      />

      {dialogOpen && (
        <TaskDialog
          selectedDate={dialogDate}
          saving={saving}
          error={formError}
          item={editingItem}
          initialItemType={newItemType}
          onClose={() => setDialogOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function CalendarTaskChip({
  item,
  onOpen,
  onDelete,
}: {
  item: CalendarItem;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const category = getCategory(item.category);

  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/calendar-item-id", String(item.id));
        event.dataTransfer.setData("text/plain", String(item.id));
        event.dataTransfer.effectAllowed = "move";
      }}
      onClick={onOpen}
      className={cn(
        "group flex min-w-0 cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-left transition hover:opacity-90",
        category.badge
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      aria-label={`Edit ${item.title}`}
      title={item.title}
    >
      <GripVertical className="h-3 w-3 shrink-0 opacity-50" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-xs font-medium">{item.title}</span>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        className="grid h-4 w-4 shrink-0 place-items-center rounded text-current opacity-0 transition hover:bg-white/60 group-hover:opacity-100"
        aria-label={`Delete ${item.title}`}
        title="Delete"
      >
        <Trash2 className="h-3 w-3" aria-hidden="true" />
      </button>
    </div>
  );
}

function DraftTaskPanel({
  drafts,
  loading,
  onCreateDraft,
  onOpen,
  onDelete,
}: {
  drafts: CalendarItem[];
  loading: boolean;
  onCreateDraft: () => void;
  onOpen: (item: CalendarItem) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <aside className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-soft xl:sticky xl:top-4 xl:self-start">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Draft Task Panel</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Save loose ideas here, then drag them onto a date.</p>
        </div>
        <Button type="button" size="icon" className="h-8 w-8 rounded-lg" onClick={onCreateDraft} aria-label="Create draft task">
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="mt-4 space-y-2" data-testid="draft-task-panel">
        {loading && (
          <>
            <div className="h-20 animate-pulse rounded-lg bg-muted" />
            <div className="h-20 animate-pulse rounded-lg bg-muted" />
          </>
        )}

        {!loading && drafts.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-white/80 p-4 text-sm leading-6 text-muted-foreground">
            No drafts yet. Add one now and schedule it when the date feels right.
          </div>
        )}

        {!loading &&
          drafts.map((draft) => {
            const category = getCategory(draft.category);
            const TypeIcon = draft.itemType === "reminder" ? Bell : CheckCircle2;

            return (
              <div
                key={draft.id}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/calendar-item-id", String(draft.id));
                  event.dataTransfer.setData("text/plain", String(draft.id));
                  event.dataTransfer.effectAllowed = "move";
                }}
                onClick={() => onOpen(draft)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen(draft);
                  }
                }}
                role="button"
                tabIndex={0}
                className={cn(
                  "cursor-pointer rounded-lg border border-border border-l-4 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft",
                  category.border
                )}
              >
                <div className="flex items-start gap-2">
                  <GripVertical className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <TypeIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <p className="truncate text-sm font-semibold">{draft.title}</p>
                    </div>
                    {draft.description && (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{draft.description}</p>
                    )}
                    <span className={cn("mt-2 inline-flex rounded-lg px-2 py-1 text-[11px] font-semibold", category.badge)}>
                      {draft.category}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDelete(draft.id)}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-red-50 hover:text-destructive"
                    aria-label={`Delete ${draft.title}`}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
      </div>
    </aside>
  );
}

function TaskDialog({
  selectedDate,
  saving,
  error,
  item,
  initialItemType,
  onClose,
  onSave,
}: {
  selectedDate: string | null;
  saving: boolean;
  error: string | null;
  item: CalendarItem | null;
  initialItemType: CalendarForm["itemType"];
  onClose: () => void;
  onSave: (form: CalendarForm, status: "scheduled" | "draft") => Promise<void>;
}) {
  const [form, setForm] = React.useState<CalendarForm>(() =>
    item ? itemToForm(item) : { ...defaultForm, itemType: initialItemType }
  );
  const isEditing = Boolean(item);

  function updateForm<Field extends keyof CalendarForm>(field: Field, value: CalendarForm[Field]) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-4 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{isEditing ? "Edit task" : "Create task"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedDate ? `Scheduled for ${formatDateLabel(selectedDate)}` : "Saving as an unscheduled draft"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Close task dialog"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form className="mt-4 space-y-3" onSubmit={(event) => event.preventDefault()}>
          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">Title</span>
            <input
              value={form.title}
              onChange={(event) => updateForm("title", event.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring/30"
              placeholder="Prepare launch notes"
              autoFocus
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">Description</span>
            <textarea
              value={form.description}
              onChange={(event) => updateForm("description", event.target.value)}
              className="mt-1 min-h-24 w-full resize-none rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-ring/30"
              placeholder="Add helpful context or reminder details"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">Type</span>
              <select
                value={form.itemType}
                onChange={(event) => updateForm("itemType", event.target.value as CalendarForm["itemType"])}
                className="mt-1 h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring/30"
              >
                <option value="task">Task</option>
                <option value="reminder">Reminder</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">Time</span>
              <input
                type="time"
                value={form.scheduledTime}
                onChange={(event) => updateForm("scheduledTime", event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring/30"
              />
            </label>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground">Category</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {categories.map((category) => (
                <button
                  key={category.name}
                  type="button"
                  onClick={() => updateForm("category", category.name)}
                  className={cn(
                    "flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-3 text-left text-xs font-semibold transition hover:bg-muted",
                    form.category === category.name && "ring-2 ring-ring/30"
                  )}
                >
                  <span className={cn("h-3 w-3 rounded-full", category.swatch)} />
                  <span className="truncate">{category.name}</span>
                </button>
              ))}
            </div>
          </div>

          {error && <div className="rounded-lg border border-destructive/25 bg-red-50 px-3 py-2 text-sm text-destructive">{error}</div>}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-lg bg-white text-xs"
              onClick={() => void onSave(form, "draft")}
              disabled={saving}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <StickyNote className="mr-2 h-4 w-4" aria-hidden="true" />}
              Save draft
            </Button>
            <Button
              type="button"
              className="h-9 rounded-lg bg-foreground text-xs text-background hover:bg-foreground/90"
              onClick={() => void onSave(form, "scheduled")}
              disabled={saving || !selectedDate}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <CalendarDays className="mr-2 h-4 w-4" aria-hidden="true" />}
              {isEditing ? "Save changes" : "Schedule task"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
