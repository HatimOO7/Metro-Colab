"use client";

import React from "react";
import {
  Activity,
  Apple,
  BookOpen,
  Briefcase,
  Camera,
  CheckSquare,
  Clock,
  Coffee,
  DollarSign,
  Flame,
  Globe,
  Heart,
  Leaf,
  Loader2,
  Moon,
  Music,
  Plus,
  Sparkles,
  Star,
  Sun,
  Target,
  Trophy,
  Zap,
  TrendingUp,
  BarChart3,
  PieChart,
  Check,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AiTemplateJson,
  AiTemplateSection,
  ActionType,
  AppState,
} from "@/db/schema";

// ─────────────────────────────────────────────────────────────────────────────
// Icon registry
// ─────────────────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  Flame, Target, Apple, BookOpen, DollarSign, Heart, Star, Zap, Coffee, Music,
  Camera, Globe, Briefcase, Clock, Trophy, Leaf, Moon, Sun, Activity,
  CheckSquare, TrendingUp, BarChart3, Sparkles, Plus,
};

// ─────────────────────────────────────────────────────────────────────────────
// AppIcon — exported for use in builder card
// ─────────────────────────────────────────────────────────────────────────────

export function AppIcon({
  name,
  color,
  size = "md",
}: {
  name: string;
  color: string;
  size?: "sm" | "md" | "lg";
}) {
  const Icon = ICON_MAP[name] ?? Zap;
  const iconSizes = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-7 w-7" };
  const paddings = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-14 w-14" };

  return (
    <div
      className={cn("grid shrink-0 place-items-center rounded-xl", paddings[size])}
      style={{ backgroundColor: `${color}22` }}
    >
      <Icon className={iconSizes[size]} style={{ color }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Action dispatcher type
// ─────────────────────────────────────────────────────────────────────────────

type HandleAction = (
  actionType: ActionType | string,
  target?: string,
  payload?: unknown
) => void;

// ─────────────────────────────────────────────────────────────────────────────
// Block renderers
// ─────────────────────────────────────────────────────────────────────────────

/* ── Stats ── */

function StatsBlock({ data, color }: { data: unknown; color: string }) {
  const items = (data as { items?: { label: string; value: string; icon?: string; trend?: string }[] })
    ?.items ?? [];

  if (items.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, i) => {
        const Icon = ICON_MAP[item.icon ?? ""] ?? Activity;
        return (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border border-border bg-white/70 p-4 shadow-sm backdrop-blur-sm transition hover:shadow-md"
          >
            <div
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
              style={{ backgroundColor: `${color}1a` }}
            >
              <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold leading-tight text-foreground">{item.value}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.label}</p>
              {item.trend && (
                <p className="mt-1 text-[11px] font-semibold" style={{ color }}>
                  {item.trend}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── List ── */

function ListBlock({
  data,
  section,
  appState,
}: {
  data: unknown;
  section: AiTemplateSection;
  appState: AppState;
}) {
  const targetKey = section.dataSource ?? section.target;
  const sourceItems = targetKey ? (appState[targetKey] as unknown[] | undefined) : null;

  const items: string[] = Array.isArray(sourceItems)
    ? sourceItems.map((it) => {
      if (typeof it === "string") return it;
      const obj = it as Record<string, unknown>;
      return String(obj.label ?? obj.name ?? obj.title ?? JSON.stringify(it));
    })
    : ((data as { items?: string[] })?.items ?? []);

  if (items.length === 0) {
    return <p className="text-sm italic text-muted-foreground">No items yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/* ── Table ── */

function TableBlock({ data }: { data: unknown }) {
  const d = data as { headers?: string[]; rows?: string[][] };
  const headers = d?.headers ?? [];
  const rows = d?.rows ?? [];

  if (headers.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className="border-b border-border last:border-0 transition hover:bg-muted/20"
            >
              {row.map((cell, ci) => (
                <td key={ci} className="px-4 py-2.5 text-sm text-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Form ── */

function FormBlock({
  data,
  color,
  section,
  appState,
  handleAction,
}: {
  data: unknown;
  color: string;
  section: AiTemplateSection;
  appState: AppState;
  handleAction: HandleAction;
}) {
  const fields =
    (data as { fields?: { name?: string; label: string; type: string; placeholder?: string; stateKey?: string; required?: boolean; options?: string[] }[] })
      ?.fields ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!section.action || !section.target) return;

    // Collect field values from appState
    const payload: Record<string, unknown> = {};
    fields.forEach((f) => {
      const key = f.stateKey ?? f.name ?? f.label;
      payload[key] = appState[key] ?? "";
    });

    handleAction(section.action, section.target, payload);

    // Clear form fields from appState after submission
    fields.forEach((f) => {
      const key = f.stateKey ?? f.name ?? f.label;
      handleAction("UPDATE_FIELD", key, "");
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field, i) => {
          const key = field.stateKey ?? field.name ?? field.label;
          const value = String(appState[key] ?? "");
          const inputClass =
            "h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition focus:border-transparent focus:ring-2";

          return (
            <div key={i} className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-foreground">
                {field.label}
                {field.required && <span className="ml-0.5 text-destructive">*</span>}
              </label>

              {field.type === "select" && field.options ? (
                <select
                  value={value}
                  onChange={(e) => handleAction("UPDATE_FIELD", key, e.target.value)}
                  className={inputClass}
                  style={{ ["--tw-ring-color" as string]: `${color}60` }}
                  required={field.required}
                >
                  <option value="">{field.placeholder ?? "Select…"}</option>
                  {(field.options as any[]).map((opt) => {
                    // Jodi object hoy tahole opt.value/opt.label use korbe, 
                    // ar jodi string hoy tahole direct opt-tai use korbe.
                    const value = typeof opt === "string" ? opt : opt?.value;
                    const label = typeof opt === "string" ? opt : opt?.label;

                    return (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              ) : field.type === "textarea" ? (
                <textarea
                  value={value}
                  onChange={(e) => handleAction("UPDATE_FIELD", key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                  className={cn(inputClass, "h-auto resize-none py-2")}
                  style={{ ["--tw-ring-color" as string]: `${color}60` }}
                  required={field.required}
                />
              ) : (
                <input
                  type={field.type ?? "text"}
                  value={value}
                  onChange={(e) => handleAction("UPDATE_FIELD", key, e.target.value)}
                  placeholder={field.placeholder}
                  className={inputClass}
                  style={{ ["--tw-ring-color" as string]: `${color}60` }}
                  required={field.required}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          className="inline-flex h-9 items-center gap-2 rounded-lg px-5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-[0.98]"
          style={{ backgroundColor: color }}
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>
    </form>
  );
}

/* ── Progress ── */

function ProgressBlock({ data }: { data: unknown }) {
  const items =
    (data as { items?: { label: string; value: number; color?: string }[] })?.items ?? [];

  return (
    <div className="space-y-4">
      {items.map((item, i) => {
        const pct = Math.min(100, Math.max(0, item.value));
        return (
          <div key={i}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{item.label}</span>
              <span className="text-xs font-bold tabular-nums text-muted-foreground">{pct}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${pct}%`, backgroundColor: item.color ?? "#6366F1" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Checklist ── */

function ChecklistBlock({
  data,
  color,
  section,
  appState,
  handleAction,
}: {
  data: unknown;
  color: string;
  section: AiTemplateSection;
  appState: AppState;
  handleAction: HandleAction;
}) {
  const targetKey = section.dataSource ?? section.target;
  const sourceItems = targetKey ? (appState[targetKey] as unknown[] | undefined) : null;

  type CheckItem = { id?: string; label?: string; name?: string; checked?: boolean; completed?: boolean };
  const items: CheckItem[] = Array.isArray(sourceItems)
    ? (sourceItems as CheckItem[])
    : ((data as { items?: CheckItem[] })?.items ?? []);

  if (items.length === 0) {
    return <p className="text-sm italic text-muted-foreground">No items yet.</p>;
  }

  const checkedCount = items.filter((it) => it.checked ?? it.completed ?? false).length;
  const totalCount = items.length;

  return (
    <div className="space-y-1">
      {/* Completion bar */}
      {totalCount > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(checkedCount / totalCount) * 100}%`, backgroundColor: color }}
            />
          </div>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
            {checkedCount}/{totalCount}
          </span>
        </div>
      )}

      <ul className="space-y-1">
        {items.map((item, i) => {
          const isChecked = item.checked ?? item.completed ?? false;
          const itemId = item.id ?? String(i);

          return (
            <li key={itemId} className="group flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const actionTarget = targetKey ?? section.target;
                  if (actionTarget) {
                    handleAction(section.action ?? "TOGGLE_ITEM", actionTarget, { id: itemId });
                  }
                }}
                className="flex flex-1 items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-muted/50 active:scale-[0.99]"
              >
                <div
                  className={cn(
                    "grid h-5 w-5 shrink-0 place-items-center rounded border-2 transition-all duration-200",
                    isChecked ? "border-transparent scale-105" : "border-border bg-white"
                  )}
                  style={isChecked ? { backgroundColor: color, borderColor: color } : {}}
                >
                  {isChecked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                </div>
                <span
                  className={cn(
                    "text-sm transition-all duration-200",
                    isChecked ? "text-muted-foreground line-through" : "text-foreground"
                  )}
                >
                  {item.label ?? item.name ?? "Untitled"}
                </span>
              </button>

              {/* Delete button — visible on hover */}
              {targetKey && (
                <button
                  type="button"
                  onClick={() => handleAction("DELETE_ITEM", targetKey, { id: itemId })}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground/50 opacity-0 transition hover:bg-red-50 hover:text-destructive group-hover:opacity-100"
                  aria-label="Delete item"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── Tags ── */

function TagsBlock({ data }: { data: unknown }) {
  const tags = (data as { items?: { label: string; color?: string }[] })?.items ?? [];

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag, i) => (
        <span
          key={i}
          className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition hover:opacity-80"
          style={{
            backgroundColor: `${tag.color ?? "#6366F1"}1a`,
            color: tag.color ?? "#6366F1",
          }}
        >
          {tag.label}
        </span>
      ))}
    </div>
  );
}

/* ── Chart (Placeholder) ── */

function ChartBlock({ data, color }: { data: unknown; color: string }) {
  const d = data as { title?: string; chartType?: string; type?: string };
  const chartType = d?.chartType ?? d?.type ?? "bar";
  const ChartIcon =
    chartType === "pie" ? PieChart : chartType === "line" ? TrendingUp : BarChart3;

  return (
    <div
      className="flex h-44 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed"
      style={{ borderColor: `${color}40`, backgroundColor: `${color}08` }}
    >
      <ChartIcon className="h-10 w-10" style={{ color: `${color}60` }} />
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">{d?.title ?? "Chart Visualization"}</p>
        <p className="mt-0.5 text-xs text-muted-foreground capitalize">{chartType} chart</p>
      </div>
    </div>
  );
}

/* ── Button ── */

function ButtonBlock({
  data,
  color,
  section,
  handleAction,
}: {
  data: unknown;
  color: string;
  section: AiTemplateSection;
  handleAction: HandleAction;
}) {
  const d = data as { label?: string; variant?: string };
  const isSecondary = d?.variant === "secondary";

  return (
    <button
      type="button"
      onClick={() => {
        if (section.action && section.target) {
          handleAction(section.action, section.target);
        }
      }}
      className="h-10 rounded-xl px-6 text-sm font-semibold shadow-sm transition hover:opacity-90 active:scale-[0.97]"
      style={
        isSecondary
          ? { backgroundColor: `${color}1a`, color }
          : { backgroundColor: color, color: "#fff" }
      }
    >
      {d?.label ?? "Action"}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section wrapper with optional collapse
// ─────────────────────────────────────────────────────────────────────────────

function Section({
  section,
  color,
  appState,
  handleAction,
}: {
  section: AiTemplateSection;
  color: string;
  appState: AppState;
  handleAction: HandleAction;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const isCollapsible = section.collapsible ?? false;

  return (
    <div className="rounded-2xl border border-border bg-card/90 shadow-sm backdrop-blur-sm transition hover:shadow-md">
      {section.title && (
        <div
          className={cn(
            "flex items-center justify-between px-5 py-3.5",
            !collapsed ? "border-b border-border/60" : ""
          )}
        >
          <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
          {isCollapsible && (
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition hover:bg-muted"
            >
              {collapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      )}

      {!collapsed && (
        <div className={cn("px-5", section.title ? "py-4" : "py-5")}>
          {section.type === "stats" && <StatsBlock data={section.data} color={color} />}
          {section.type === "list" && (
            <ListBlock data={section.data} section={section} appState={appState} />
          )}
          {section.type === "table" && <TableBlock data={section.data} />}
          {section.type === "form" && (
            <FormBlock
              data={section.data}
              color={color}
              section={section}
              appState={appState}
              handleAction={handleAction}
            />
          )}
          {section.type === "progress" && <ProgressBlock data={section.data} />}
          {section.type === "checklist" && (
            <ChecklistBlock
              data={section.data}
              color={color}
              section={section}
              appState={appState}
              handleAction={handleAction}
            />
          )}
          {section.type === "tags" && <TagsBlock data={section.data} />}
          {section.type === "chart" && <ChartBlock data={section.data} color={color} />}
          {section.type === "button" && (
            <ButtonBlock
              data={section.data}
              color={color}
              section={section}
              handleAction={handleAction}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Saving indicator
// ─────────────────────────────────────────────────────────────────────────────

function SavingIndicator({ saving }: { saving: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all duration-300",
        saving
          ? "bg-amber-50 text-amber-600"
          : "bg-emerald-50 text-emerald-600"
      )}
    >
      {saving ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          Saving…
        </>
      ) : (
        <>
          <Check className="h-3 w-3" />
          Saved
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main renderer
// ─────────────────────────────────────────────────────────────────────────────

interface AppPreviewRendererProps {
  appJson: AiTemplateJson;
  templateId?: number;
}

export function AppPreviewRenderer({ appJson, templateId }: AppPreviewRendererProps) {
  const { appName, description, icon, color, sections, actions, initialState } = appJson;

  // ── State ──────────────────────────────────────────────────────────────────

  const [appState, setAppState] = React.useState<AppState>(
    (initialState as AppState) ?? {}
  );
  const [loadingState, setLoadingState] = React.useState<boolean>(!!templateId);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState<boolean>(false);

  // ── Refs — keep always-current state without stale closures ───────────────

  /**
   * stateRef always holds the LATEST appState. It is updated synchronously
   * in the setAppState updater so the debounced save always sends fresh data.
   */
  const stateRef = React.useRef<AppState>(appState);

  /** Debounce timer handle — cleared & reset on every action */
  const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * AbortController ref — if a PUT request is still in-flight when the next
   * debounce fires, we abort the previous request before launching a new one.
   * This guarantees only the latest state ever reaches the database.
   */
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // ── 1. Fetch & merge initial state from server ────────────────────────────

  React.useEffect(() => {
    if (!templateId) return;

    let mounted = true;
    setLoadingState(true);
    setFetchError(null);

    fetch(`/api/ai-templates/${templateId}/state`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ appState: AppState }>;
      })
      .then((data) => {
        if (!mounted) return;
        // Safe merge: initialState provides defaults, persisted state takes precedence
        const merged: AppState = {
          ...((initialState as AppState) ?? {}),
          ...(data.appState ?? {}),
        };
        setAppState(merged);
        stateRef.current = merged;
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error(`[AppPreviewRenderer] Failed to load state for template ${templateId}:`, msg);
        setFetchError("Could not load saved state. Showing defaults.");
        // Don't block the UI — fall back to initialState
      })
      .finally(() => {
        if (mounted) setLoadingState(false);
      });

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // ── 2. Action dispatcher with debounced, abort-safe persistence ───────────

  const handleAction = React.useCallback<HandleAction>(
    (actionType, target, payload) => {
      if (!target) return;

      setAppState((prev) => {
        // ── Compute next state ──────────────────────────────────────────────
        const next = { ...prev };

        switch (actionType) {
          case "UPDATE_FIELD": {
            /**
             * Deep-merge protection: if the target already holds an object and
             * the payload is also an object, perform a shallow merge so that
             * sibling keys in the existing object are not wiped out.
             */
            if (
              typeof payload === "object" &&
              payload !== null &&
              !Array.isArray(payload) &&
              typeof next[target] === "object" &&
              next[target] !== null &&
              !Array.isArray(next[target])
            ) {
              next[target] = {
                ...(next[target] as Record<string, unknown>),
                ...(payload as Record<string, unknown>),
              };
            } else {
              next[target] = payload;
            }
            break;
          }

          case "ADD_ITEM": {
            const newItem = {
              id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
              ...(typeof payload === "object" && payload !== null
                ? (payload as Record<string, unknown>)
                : { label: payload }),
              checked: false,
              completed: false,
            };
            next[target] = Array.isArray(next[target])
              ? [...(next[target] as unknown[]), newItem]
              : [newItem];
            break;
          }

          case "TOGGLE_ITEM": {
            if (!Array.isArray(next[target])) break;
            const id = (payload as { id?: string })?.id;
            next[target] = (next[target] as Record<string, unknown>[]).map((item) =>
              item.id === id
                ? { ...item, checked: !item.checked, completed: !item.completed }
                : item
            );
            break;
          }

          case "DELETE_ITEM": {
            if (!Array.isArray(next[target])) break;
            const id = (payload as { id?: string })?.id;
            next[target] = (next[target] as Record<string, unknown>[]).filter(
              (item) => item.id !== id
            );
            break;
          }

          case "CLEAR_ALL": {
            if (Array.isArray(next[target])) {
              next[target] = [];
            }
            break;
          }
        }

        // ── Sync latest state to ref immediately (no stale closure risk) ──
        stateRef.current = next;

        // ── Debounced, abort-safe save ─────────────────────────────────────
        if (templateId) {
          // Cancel pending debounce
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
          }

          setSaving(true);

          saveTimeoutRef.current = setTimeout(() => {
            // Abort any in-flight PUT from the previous debounce window
            if (abortControllerRef.current) {
              abortControllerRef.current.abort();
            }
            abortControllerRef.current = new AbortController();

            // Always use stateRef.current — guaranteed to be the latest state
            fetch(`/api/ai-templates/${templateId}/state`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ appState: stateRef.current }),
              signal: abortControllerRef.current.signal,
            })
              .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                setSaving(false);
              })
              .catch((err: unknown) => {
                if (err instanceof Error && err.name === "AbortError") return; // expected
                console.error("[AppPreviewRenderer] Failed to save state:", err);
                setSaving(false);
              });
          }, 800);
        }

        return next;
      });
    },
    [templateId]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (loadingState) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
        <div
          className="grid h-16 w-16 place-items-center rounded-2xl"
          style={{ backgroundColor: `${color}20` }}
        >
          <Loader2 className="h-7 w-7 animate-spin" style={{ color }} />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">Loading your app…</p>
          <p className="mt-1 text-xs text-muted-foreground">Fetching saved state</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background/50">
      {/* ── App header ──────────────────────────────────────────────────── */}
      <div
        className="flex shrink-0 items-center gap-4 border-b border-border/60 px-6 py-5"
        style={{
          background: `linear-gradient(135deg, ${color}12 0%, ${color}06 100%)`,
        }}
      >
        <AppIcon name={icon} color={color} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold tracking-tight text-foreground">{appName}</h2>
          <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{description}</p>
        </div>

        {/* Saving indicator + action buttons */}
        <div className="flex shrink-0 items-center gap-2">
          {templateId && <SavingIndicator saving={saving} />}

          {Array.isArray(actions) &&
            actions.slice(0, 2).map((action, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (action.action && action.target) {
                    handleAction(action.action, action.target);
                  }
                }}
                className="h-8 rounded-lg px-3.5 text-xs font-semibold shadow-sm transition hover:opacity-90 active:scale-[0.97]"
                style={
                  i === 0
                    ? { backgroundColor: color, color: "#fff" }
                    : { backgroundColor: `${color}18`, color }
                }
              >
                {action.label}
              </button>
            ))}
        </div>
      </div>

      {/* ── State fetch error banner ────────────────────────────────────── */}
      {fetchError && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-xs font-medium text-amber-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {fetchError}
        </div>
      )}

      {/* ── Sections ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5">
        <div className="mx-auto max-w-3xl space-y-4 pb-12">
          {Array.isArray(sections) && sections.length > 0 ? (
            sections.map((section) => (
              <Section
                key={section.id}
                section={section}
                color={color}
                appState={appState}
                handleAction={handleAction}
              />
            ))
          ) : (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Sparkles className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No sections configured for this app.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
