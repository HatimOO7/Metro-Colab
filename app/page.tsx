"use client";

import {
  Bot,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  LayoutDashboard,
  Layers3,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  Plus,
  Search,
  Settings,
  Sparkles,
  StickyNote,
  UsersRound,
} from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MenuItem = {
  label: string;
  icon: React.ElementType;
  color: string;
};

const menuGroups: { label: string; items: MenuItem[] }[] = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, color: "text-coral-600" },
      { label: "AI Assistant", icon: Bot, color: "text-violet-600" },
      { label: "Calendar", icon: CalendarDays, color: "text-sky-600" },
      { label: "Task / Kanban", icon: ClipboardCheck, color: "text-emerald-600" },
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
  {
    label: "System",
    items: [{ label: "Settings", icon: Settings, color: "text-slate-600" }],
  },
];

const spaces = [
  { name: "Launch OS", meta: "12 docs", tint: "bg-coral-100 text-coral-700" },
  { name: "Design Lab", meta: "8 boards", tint: "bg-sky-100 text-sky-700" },
  { name: "Research Notes", meta: "24 cards", tint: "bg-emerald-100 text-emerald-700" },
];

const tasks = [
  { title: "Refine onboarding map", status: "In review", color: "bg-amber-100 text-amber-700" },
  { title: "Draft AI template prompts", status: "Today", color: "bg-violet-100 text-violet-700" },
  { title: "Sync launch calendar", status: "Next", color: "bg-sky-100 text-sky-700" },
];

const notes = [
  "Weekly planning ritual",
  "Workspace navigation patterns",
  "Whiteboard export ideas",
];

export default function Home() {
  const [collapsed, setCollapsed] = React.useState(false);
  const [activeItem, setActiveItem] = React.useState("Dashboard");

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside
          className={cn(
            "flex shrink-0 flex-col border-b border-border bg-sidebar px-3 py-4 transition-all duration-300 md:min-h-screen md:border-b-0 md:border-r",
            collapsed ? "md:w-[72px]" : "md:w-[240px]"
          )}
        >
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex min-w-0 items-center gap-2">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-foreground text-background shadow-soft">
                <Layers3 className="h-5 w-5" aria-hidden="true" />
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold leading-5">Metro Colab</p>
                  <p className="truncate text-[11px] text-muted-foreground">Think, plan, create</p>
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
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          </div>

          <nav className="mt-5 flex flex-1 flex-col gap-4" aria-label="Primary navigation">
            {menuGroups.map((group) => (
              <div key={group.label}>
                {!collapsed && (
                  <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
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
                        onClick={() => setActiveItem(item.label)}
                        className={cn(
                          "flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-xs font-medium transition",
                          collapsed && "justify-center px-0",
                          active
                            ? "bg-sidebar-active text-foreground shadow-soft"
                            : "text-muted-foreground hover:bg-white/70 hover:text-foreground"
                        )}
                        aria-label={item.label}
                        title={item.label}
                      >
                        <Icon className={cn("h-4 w-4 shrink-0", item.color)} aria-hidden="true" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-5 rounded-lg border border-border bg-white/70 p-2">
            {collapsed ? (
              <div className="grid place-items-center">
                <UsersRound className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
                  <UsersRound className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">Team workspace</p>
                  <p className="truncate text-[11px] text-muted-foreground">3 online collaborators</p>
                </div>
              </div>
            )}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex flex-col gap-3 border-b border-border bg-background/85 px-4 py-4 backdrop-blur md:flex-row md:items-center md:justify-between lg:px-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Productivity Hub</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground md:text-3xl">
                Build the week with clarity.
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-9 min-w-[190px] items-center gap-2 rounded-lg border border-border bg-white px-3 text-xs text-muted-foreground shadow-soft">
                <Search className="h-4 w-4 text-sky-600" aria-hidden="true" />
                Search pages, boards, tasks
              </div>
              <Button className="h-9 rounded-lg bg-foreground text-xs text-background hover:bg-foreground/90">
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                New space
              </Button>
            </div>
          </header>

          <div className="grid gap-4 px-4 py-5 lg:grid-cols-[1.5fr_1fr] lg:px-6">
            <section className="space-y-4">
              <div className="rounded-lg border border-border bg-card p-4 shadow-soft">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">Focus board</p>
                    <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                      A calm overview for tasks, ideas, notes, and async collaboration across your team.
                    </p>
                  </div>
                  <span className="inline-flex w-fit items-center rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    Live workspace
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {spaces.map((space) => (
                    <button
                      key={space.name}
                      type="button"
                      className="rounded-lg border border-border bg-white p-3 text-left transition hover:-translate-y-0.5 hover:shadow-soft"
                    >
                      <span className={cn("inline-flex rounded-lg px-2 py-1 text-[11px] font-semibold", space.tint)}>
                        {space.meta}
                      </span>
                      <p className="mt-3 truncate text-sm font-semibold">{space.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Open canvas and docs</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-border bg-card p-4 shadow-soft">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Task lane</p>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <div className="mt-4 space-y-2">
                    {tasks.map((task) => (
                      <div key={task.title} className="rounded-lg border border-border bg-white p-3">
                        <p className="truncate text-sm font-medium">{task.title}</p>
                        <span className={cn("mt-2 inline-flex rounded-lg px-2 py-1 text-[11px] font-semibold", task.color)}>
                          {task.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-4 shadow-soft">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Notes pulse</p>
                    <FileText className="h-4 w-4 text-amber-600" aria-hidden="true" />
                  </div>
                  <div className="mt-4 space-y-2">
                    {notes.map((note) => (
                      <button
                        key={note}
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-left text-sm transition hover:bg-amber-50"
                      >
                        <StickyNote className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                        <span className="truncate">{note}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <aside className="space-y-4">
              <div className="rounded-lg border border-border bg-card p-4 shadow-soft">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Today</p>
                  <CalendarDays className="h-4 w-4 text-sky-600" aria-hidden="true" />
                </div>
                <div className="mt-4 space-y-3">
                  {["Design critique", "AI template review", "Kanban cleanup"].map((event, index) => (
                    <div key={event} className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-sky-100 text-xs font-semibold text-sky-700">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{event}</p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock3 className="h-3 w-3" aria-hidden="true" />
                          {index + 10}:00
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-foreground p-4 text-background shadow-soft">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">AI Assistant</p>
                  <Sparkles className="h-4 w-4 text-amber-300" aria-hidden="true" />
                </div>
                <p className="mt-3 text-sm leading-6 text-background/75">
                  Draft a meeting brief from the launch notes and turn open questions into task cards.
                </p>
                <Button className="mt-4 h-9 w-full rounded-lg bg-background text-xs text-foreground hover:bg-background/90">
                  Generate brief
                </Button>
              </div>

              <div className="rounded-lg border border-border bg-card p-4 shadow-soft">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Whiteboard activity</p>
                  <ChevronLeft className="h-4 w-4 text-fuchsia-600" aria-hidden="true" />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="h-20 rounded-lg bg-coral-100" />
                  <div className="h-20 rounded-lg bg-sky-100" />
                  <div className="h-20 rounded-lg bg-emerald-100" />
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
