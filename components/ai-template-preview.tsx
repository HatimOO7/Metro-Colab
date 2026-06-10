"use client";

import * as React from "react";
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
  Moon,
  Music,
  Star,
  Sun,
  Target,
  Trophy,
  Zap,
  TrendingUp,
  BarChart3,
  PieChart,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AiTemplateJson, AiTemplateSection } from "@/db/schema";

// ── Icon map ──────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  Flame, Target, Apple, BookOpen, DollarSign, Heart, Star, Zap, Coffee, Music,
  Camera, Globe, Briefcase, Clock, Trophy, Leaf, Moon, Sun, Activity, CheckSquare,
  TrendingUp, BarChart3,
};

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
  const sizes = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-7 w-7" };
  const paddings = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-14 w-14" };

  return (
    <div
      className={cn("grid shrink-0 place-items-center rounded-xl", paddings[size])}
      style={{ backgroundColor: `${color}20` }}
    >
      <Icon className={cn(sizes[size])} style={{ color }} />
    </div>
  );
}

// ── Individual block renderers ────────────────────────────────────────────────

function StatsBlock({ data, color }: { data: unknown; color: string }) {
  const stats = (data as { items?: { label: string; value: string; icon?: string; trend?: string }[] })
    ?.items ?? [];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {stats.map((item, i) => {
        const Icon = ICON_MAP[item.icon ?? ""] ?? Activity;
        return (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border border-border bg-white p-4 shadow-soft"
          >
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg"
              style={{ backgroundColor: `${color}18` }}
            >
              <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold leading-none text-foreground">{item.value}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.label}</p>
              {item.trend && (
                <p className="mt-1 text-[11px] font-medium" style={{ color }}>
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

function ListBlock({ data }: { data: unknown }) {
  const items = (data as { items?: string[] })?.items ?? [];
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-foreground">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function TableBlock({ data }: { data: unknown }) {
  const d = data as { headers?: string[]; rows?: string[][] };
  const headers = d?.headers ?? [];
  const rows = d?.rows ?? [];

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-border last:border-0 hover:bg-muted/20">
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

function FormBlock({ data, color }: { data: unknown; color: string }) {
  const fields = (data as { fields?: { label: string; type: string; placeholder?: string }[] })
    ?.fields ?? [];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((field, i) => (
        <div key={i} className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-foreground">{field.label}</label>
          <input
            type={field.type === "select" ? "text" : field.type}
            placeholder={field.placeholder}
            className="h-9 rounded-lg border border-border bg-white px-3 text-sm outline-none focus:ring-2"
            style={{ "--tw-ring-color": `${color}40` } as React.CSSProperties}
            readOnly
          />
        </div>
      ))}
    </div>
  );
}

function ProgressBlock({ data }: { data: unknown }) {
  const items = (data as { items?: { label: string; value: number; color?: string }[] })?.items ?? [];

  return (
    <div className="space-y-4">
      {items.map((item, i) => (
        <div key={i}>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{item.label}</span>
            <span className="text-xs font-semibold text-muted-foreground">{item.value}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, Math.max(0, item.value))}%`, backgroundColor: item.color ?? "#6366F1" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ChecklistBlock({ data, color }: { data: unknown; color: string }) {
  const [items, setItems] = React.useState<{ label: string; checked: boolean }[]>(
    (data as { items?: { label: string; checked: boolean }[] })?.items ?? []
  );

  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i}>
          <button
            type="button"
            onClick={() =>
              setItems((prev) =>
                prev.map((it, idx) => (idx === i ? { ...it, checked: !it.checked } : it))
              )
            }
            className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-muted/40"
          >
            <div
              className={cn(
                "grid h-5 w-5 shrink-0 place-items-center rounded border-2 transition",
                item.checked ? "border-transparent" : "border-border bg-white"
              )}
              style={item.checked ? { backgroundColor: color, borderColor: color } : {}}
            >
              {item.checked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
            </div>
            <span
              className={cn("text-sm", item.checked ? "text-muted-foreground line-through" : "text-foreground")}
            >
              {item.label}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function TagsBlock({ data }: { data: unknown }) {
  const tags = (data as { items?: { label: string; color?: string }[] })?.items ?? [];

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag, i) => (
        <span
          key={i}
          className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
          style={{ backgroundColor: `${tag.color ?? "#6366F1"}18`, color: tag.color ?? "#6366F1" }}
        >
          {tag.label}
        </span>
      ))}
    </div>
  );
}

function ChartBlock({ data, color }: { data: unknown; color: string }) {
  const d = data as { title?: string; type?: string };
  const ChartIcon = d?.type === "pie" ? PieChart : d?.type === "line" ? TrendingUp : BarChart3;

  return (
    <div
      className="flex h-40 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed"
      style={{ borderColor: `${color}40`, backgroundColor: `${color}08` }}
    >
      <ChartIcon className="h-10 w-10" style={{ color: `${color}60` }} />
      <p className="text-sm font-medium text-muted-foreground">{d?.title ?? "Chart visualization"}</p>
      <p className="text-[11px] text-muted-foreground/60">
        {(d?.type ?? "bar").charAt(0).toUpperCase() + (d?.type ?? "bar").slice(1)} Chart
      </p>
    </div>
  );
}

function ButtonBlock({ data, color }: { data: unknown; color: string }) {
  const d = data as { label?: string; variant?: string };
  const isSecondary = d?.variant === "secondary";

  return (
    <button
      type="button"
      className="h-10 rounded-xl px-6 text-sm font-semibold transition hover:opacity-90"
      style={
        isSecondary
          ? { backgroundColor: `${color}18`, color }
          : { backgroundColor: color, color: "#fff" }
      }
    >
      {d?.label ?? "Action"}
    </button>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ section, color }: { section: AiTemplateSection; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
      {section.title && (
        <h3 className="mb-4 text-sm font-semibold text-foreground">{section.title}</h3>
      )}
      {section.type === "stats" && <StatsBlock data={section.data} color={color} />}
      {section.type === "list" && <ListBlock data={section.data} />}
      {section.type === "table" && <TableBlock data={section.data} />}
      {section.type === "form" && <FormBlock data={section.data} color={color} />}
      {section.type === "progress" && <ProgressBlock data={section.data} />}
      {section.type === "checklist" && <ChecklistBlock data={section.data} color={color} />}
      {section.type === "tags" && <TagsBlock data={section.data} />}
      {section.type === "chart" && <ChartBlock data={section.data} color={color} />}
      {section.type === "button" && <ButtonBlock data={section.data} color={color} />}
    </div>
  );
}

// ── Main renderer ─────────────────────────────────────────────────────────────

export function AppPreviewRenderer({ appJson }: { appJson: AiTemplateJson }) {
  const { appName, description, icon, color, sections, actions } = appJson;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* App header */}
      <div
        className="flex items-center gap-4 px-6 py-5"
        style={{ background: `linear-gradient(135deg, ${color}18 0%, ${color}08 100%)` }}
      >
        <AppIcon name={icon} color={color} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-foreground">{appName}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
        {actions.length > 0 && (
          <div className="flex shrink-0 gap-2">
            {actions.slice(0, 2).map((action, i) => (
              <button
                key={i}
                type="button"
                className="h-9 rounded-lg px-4 text-xs font-semibold transition hover:opacity-90"
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
        )}
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="space-y-4">
          {sections.map((section) => (
            <Section key={section.id} section={section} color={color} />
          ))}
        </div>
      </div>
    </div>
  );
}
