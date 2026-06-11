"use client";

import * as React from "react";
import {
  AlertCircle,
  BookOpen,
  ChevronRight,
  ExternalLink,
  Flame,
  Loader2,
  PanelRightOpen,
  Pin,
  PinOff,
  Plus,
  Sparkles,
  Target,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AppPreviewRenderer, AppIcon } from "@/components/AppPreviewRenderer";
import type { AiTemplate } from "@/db/schema";
import type { AiTemplateJson } from "@/db/schema";


// ── Types ─────────────────────────────────────────────────────────────────────

type TemplateWithPin = AiTemplate & { isPinned?: boolean };

// ── Prompt suggestions ────────────────────────────────────────────────────────

const SUGGESTIONS = [
  { label: "Habit Tracker", icon: Flame, prompt: "Habit tracker with daily streaks and weekly progress" },
  { label: "Budget Planner", icon: Target, prompt: "Personal budget tracker with income, expenses, and savings goals" },
  { label: "Study Planner", icon: BookOpen, prompt: "Study planner with subjects, schedules, and progress tracking" },
  { label: "Meal Planner", icon: Zap, prompt: "Weekly meal planner with recipes and nutrition goals" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(date)
  );
}

// ── App Card ──────────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  isPinned,
  onPreview,
  onTogglePin,
  onDelete,
  pinCount,
}: {
  template: AiTemplate;
  isPinned: boolean;
  onPreview: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
  pinCount: number;
}) {
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const json = template.appJson;
  const canPin = isPinned || pinCount < 3;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg">
      {/* Color stripe */}
      <div
        className="h-1.5 w-full"
        style={{ background: `linear-gradient(90deg, ${json.color}, ${json.color}80)` }}
      />

      <div className="flex flex-1 flex-col p-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <AppIcon name={json.icon} color={json.color} size="md" />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-bold text-foreground">{json.appName}</h3>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{json.description}</p>
          </div>
        </div>

        {/* Color tag + date */}
        <div className="mt-3 flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ backgroundColor: `${json.color}18`, color: json.color }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: json.color }}
            />
            {json.widgets ? json.widgets.length : 0} widgets
          </span>
          <span className="text-[11px] text-muted-foreground">
            {formatDate(template.createdAt)}
          </span>
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="h-8 flex-1 rounded-lg text-xs font-semibold"
            style={{ backgroundColor: json.color, color: "#fff" }}
            onClick={onPreview}
          >
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Open
          </Button>

          <button
            type="button"
            title={
              isPinned
                ? "Remove from sidebar"
                : canPin
                  ? "Add to sidebar"
                  : "Sidebar full (max 3)"
            }
            onClick={onTogglePin}
            disabled={!canPin}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-lg border border-border transition",
              isPinned
                ? "bg-amber-50 text-amber-600 hover:bg-amber-100"
                : canPin
                  ? "bg-white text-muted-foreground hover:bg-muted hover:text-foreground"
                  : "cursor-not-allowed bg-muted/50 text-muted-foreground/40"
            )}
          >
            {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </button>

          {confirmDelete ? (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={onDelete}
                className="h-8 rounded-lg bg-red-600 px-2 text-[11px] font-semibold text-white transition hover:bg-red-700"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="h-8 w-8 rounded-lg border border-border bg-white text-muted-foreground transition hover:bg-muted"
              >
                <X className="mx-auto h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              title="Delete app"
              onClick={() => setConfirmDelete(true)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-white text-muted-foreground transition hover:bg-red-50 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Preview Panel ─────────────────────────────────────────────────────────────

function PreviewPanel({
  template,
  onClose,
}: {
  template: AiTemplate | null;
  onClose: () => void;
}) {
  if (!template) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside className="fixed bottom-0 right-0 top-0 z-40 flex w-full max-w-2xl flex-col border-l border-border bg-background shadow-2xl">
        {/* Panel header */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-3">
          <AppIcon name={template.appJson.icon} color={template.appJson.color} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{template.appJson.appName}</p>
            <p className="text-[11px] text-muted-foreground">Live preview</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-white text-muted-foreground transition hover:bg-muted"
            aria-label="Close preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Renderer */}
        <div className="flex-1 overflow-hidden">
          <AppPreviewRenderer appJson={template.appJson} templateId={template.id} />
        </div>
      </aside>
    </>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onSuggest }: { onSuggest: (prompt: string) => void }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-orange-100">
        <Sparkles className="h-8 w-8 text-orange-500" />
      </div>
      <p className="mt-4 text-base font-semibold text-foreground">No apps generated yet</p>
      <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
        Enter a prompt above or try one of these popular templates:
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SUGGESTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.label}
              type="button"
              onClick={() => onSuggest(s.prompt)}
              className="flex flex-col items-center gap-2 rounded-xl border border-border bg-white p-4 transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-soft"
            >
              <Icon className="h-6 w-6 text-orange-500" />
              <span className="text-xs font-semibold text-foreground">{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function AiTemplateBuilderPage({ onOpenTemplate }: { onOpenTemplate?: (id: number) => void }) {
  const [prompt, setPrompt] = React.useState("");
  const [generating, setGenerating] = React.useState(false);
  const [genError, setGenError] = React.useState<string | null>(null);

  const [templates, setTemplates] = React.useState<AiTemplate[]>([]);
  const [pinnedIds, setPinnedIds] = React.useState<Set<number>>(new Set());
  const [loadingTemplates, setLoadingTemplates] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  const [previewTemplate, setPreviewTemplate] = React.useState<AiTemplate | null>(null);

  // ── Load templates + sidebar pins ──────────────────────────────────────────

  const loadData = React.useCallback(async () => {
    setLoadingTemplates(true);
    setFetchError(null);
    try {
      const [tRes, pRes] = await Promise.all([
        fetch("/api/ai-templates"),
        fetch("/api/ai-templates/sidebar"),
      ]);

      if (!tRes.ok) throw new Error("Failed to load templates");
      if (!pRes.ok) throw new Error("Failed to load sidebar pins");

      const tData = (await tRes.json()) as { templates: AiTemplate[] };
      const pData = (await pRes.json()) as { pins: { id: number }[] };

      setTemplates(tData.templates);
      setPinnedIds(new Set(pData.pins.map((p) => p.id)));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  // ── Generate ───────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setGenError("Please enter a prompt to generate an app.");
      return;
    }

    setGenerating(true);
    setGenError(null);

    try {
      const res = await fetch("/api/ai/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });

      const data = (await res.json()) as { template?: AiTemplate; simulated?: boolean; error?: string };

      if (!res.ok || !data.template) {
        setGenError(data.error ?? "AI generation failed. Please try again.");
        return;
      }

      setTemplates((prev) => [data.template!, ...prev]);
      setPrompt("");
      if (data.simulated) {
        toast.info("Using simulated AI output (no API key configured)");
      } else {
        toast.success(`"${data.template.appName}" created!`);
      }
    } catch {
      setGenError("Network error. Please check your connection.");
    } finally {
      setGenerating(false);
    }
  };

  // ── Pin / Unpin ────────────────────────────────────────────────────────────

  const handleTogglePin = async (template: AiTemplate) => {
    const isCurrentlyPinned = pinnedIds.has(template.id);

    if (isCurrentlyPinned) {
      // Optimistic remove
      setPinnedIds((prev) => { const next = new Set(prev); next.delete(template.id); return next; });
      const res = await fetch("/api/ai-templates/sidebar", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: template.id }),
      });
      if (!res.ok) {
        setPinnedIds((prev) => new Set([...prev, template.id]));
        toast.error("Failed to remove from sidebar");
      } else {
        toast.success(`"${template.appName}" removed from sidebar`);
      }
    } else {
      if (pinnedIds.size >= 3) {
        toast.warning("Sidebar limit reached — maximum 3 apps can be pinned");
        return;
      }
      // Optimistic add
      setPinnedIds((prev) => new Set([...prev, template.id]));
      const res = await fetch("/api/ai-templates/sidebar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: template.id }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setPinnedIds((prev) => { const next = new Set(prev); next.delete(template.id); return next; });
        toast.error(data.error ?? "Failed to pin app");
      } else {
        toast.success(`"${template.appName}" added to sidebar`);
      }
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async (template: AiTemplate) => {
    // Optimistic remove
    setTemplates((prev) => prev.filter((t) => t.id !== template.id));
    setPinnedIds((prev) => { const next = new Set(prev); next.delete(template.id); return next; });

    const res = await fetch("/api/ai-templates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: template.id }),
    });

    if (!res.ok) {
      void loadData();
      toast.error("Failed to delete app");
    } else {
      toast.success(`"${template.appName}" deleted`);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-full flex-col">
      {/* Page header */}
      <div className="border-b border-border bg-background/85 px-4 py-5 backdrop-blur lg:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Create
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          AI Template Builder
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Describe any mini-app and AI will generate a fully-functioning single-page experience.
        </p>
      </div>

      <div className="flex-1 px-4 py-6 lg:px-8">
        {/* Prompt box */}
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <label className="mb-2 block text-sm font-semibold text-foreground">
              What would you like to build?
            </label>

            <div className="flex gap-3">
              <textarea
                value={prompt}
                onChange={(e) => { setPrompt(e.target.value); setGenError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleGenerate(); }}
                placeholder="e.g. Habit tracker with daily streaks, weekly progress charts, and motivational quotes"
                rows={3}
                className="flex-1 resize-none rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-orange-300 transition"
                disabled={generating}
              />
            </div>

            {/* Quick suggestions */}
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => setPrompt(s.prompt)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-muted-foreground transition hover:border-orange-300 hover:text-orange-600"
                  >
                    <Icon className="h-3 w-3" />
                    {s.label}
                  </button>
                );
              })}
            </div>

            {genError && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {genError}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">
                Press <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono">⌘ Enter</kbd> to generate
              </p>
              <Button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={generating || !prompt.trim()}
                className="h-10 rounded-xl bg-orange-500 px-6 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate App
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Templates grid */}
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">Your Generated Apps</h2>
              {!loadingTemplates && templates.length > 0 && (
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-600">
                  {templates.length}
                </span>
              )}
            </div>
            {pinnedIds.size > 0 && (
              <span className="text-[11px] text-muted-foreground">
                {pinnedIds.size}/3 pinned to sidebar
              </span>
            )}
          </div>

          {loadingTemplates ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground">{fetchError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadData()}
              >
                Retry
              </Button>
            </div>
          ) : templates.length === 0 ? (
            <EmptyState onSuggest={(p) => { setPrompt(p); }} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  isPinned={pinnedIds.has(template.id)}
                  pinCount={pinnedIds.size}
                  onPreview={() => {
                    if (onOpenTemplate) {
                      onOpenTemplate(template.id);
                    } else {
                      setPreviewTemplate(template);
                    }
                  }}
                  onTogglePin={() => void handleTogglePin(template)}
                  onDelete={() => void handleDelete(template)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Preview panel */}
      <PreviewPanel template={previewTemplate} onClose={() => setPreviewTemplate(null)} />
    </div>
  );
}
