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
  Edit,
  X,
  Search,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AiTemplateJson } from "@/db/schema";

// ─────────────────────────────────────────────────────────────────────────────
// Icon registry
// ─────────────────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  Flame, Target, Apple, BookOpen, DollarSign, Heart, Star, Zap, Coffee, Music,
  Camera, Globe, Briefcase, Clock, Trophy, Leaf, Moon, Sun, Activity,
  CheckSquare, TrendingUp, BarChart3, Sparkles, Plus,
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

interface AppPreviewRendererProps {
  appJson: AiTemplateJson;
  templateId?: number;
  onBack?: () => void;
}

export function AppPreviewRenderer({ appJson, templateId, onBack }: AppPreviewRendererProps) {
  const { appName, description, icon, color, entities, forms, widgets, actions } = appJson;
  const [records, setRecords] = React.useState<Record<string, any[]>>({});
  const [loading, setLoading] = React.useState<boolean>(!!templateId);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState<boolean>(false);

  // Search and filter states (per widget ID)
  const [searchQueries, setSearchQueries] = React.useState<Record<string, string>>({});
  const [selectedFilters, setSelectedFilters] = React.useState<Record<string, Record<string, string>>>({});

  // CRUD states
  const [editingRecord, setEditingRecord] = React.useState<{ id: number; entityName: string; data: Record<string, any> } | null>(null);
  const [formValues, setFormValues] = React.useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = React.useState<Record<string, string>>({});

  // ── 1. Fetch records ──────────────────────────────────────────────────────
  const fetchRecords = React.useCallback(async () => {
    if (!templateId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai-templates/${templateId}/records`);
      if (!res.ok) throw new Error("Failed to load app records");
      const data = await res.json();
      setRecords(data.records || {});
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load records");
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  React.useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // ── 2. Validation Helper ──────────────────────────────────────────────────
  const validateForm = (entityName: string, values: Record<string, any>, formFields: any[]) => {
    const errors: Record<string, string> = {};
    const entitySchema = entities?.find((e) => e.name === entityName);
    if (!entitySchema) return errors;

    for (const f of formFields) {
      const val = values[f.name];
      const schemaField = entitySchema.fields?.find((sf) => sf.name === f.name);

      if (f.required && (val === undefined || val === null || val === "")) {
        errors[f.name] = `${f.label || f.name} is required`;
        continue;
      }

      if (val !== undefined && val !== null && val !== "") {
        if (schemaField?.type === "number") {
          const num = Number(val);
          if (isNaN(num)) {
            errors[f.name] = "Must be a valid number";
          } else if (schemaField.validation) {
            if (schemaField.validation.min !== undefined && num < schemaField.validation.min) {
              errors[f.name] = `Must be at least ${schemaField.validation.min}`;
            }
            if (schemaField.validation.max !== undefined && num > schemaField.validation.max) {
              errors[f.name] = `Must be at most ${schemaField.validation.max}`;
            }
          }
        } else if (schemaField?.type === "text" || schemaField?.type === "textarea") {
          const str = String(val);
          if (schemaField.validation) {
            if (schemaField.validation.minLength !== undefined && str.length < schemaField.validation.minLength) {
              errors[f.name] = `Must be at least ${schemaField.validation.minLength} chars`;
            }
            if (schemaField.validation.maxLength !== undefined && str.length > schemaField.validation.maxLength) {
              errors[f.name] = `Must be at most ${schemaField.validation.maxLength} chars`;
            }
          }
        }
      }
    }
    return errors;
  };

  // ── 3. Submit Handler (Create or Update) ──────────────────────────────────
  const handleFormSubmit = async (e: React.FormEvent, formConfig: any) => {
    e.preventDefault();
    const entityName = formConfig.entity;

    const errors = validateForm(entityName, formValues, formConfig.fields);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editingRecord) {
        // Update
        const res = await fetch(`/api/ai-templates/${templateId}/records/${editingRecord.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: formValues }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Failed to update record");
        }
        const data = await res.json();
        setRecords((prev) => ({
          ...prev,
          [entityName]: (prev[entityName] || []).map((r) => (r.id === editingRecord.id ? data.record : r)),
        }));
        setEditingRecord(null);
      } else {
        // Create
        const res = await fetch(`/api/ai-templates/${templateId}/records`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityName, data: formValues }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Failed to create record");
        }
        const data = await res.json();
        setRecords((prev) => ({
          ...prev,
          [entityName]: [...(prev[entityName] || []), data.record],
        }));
      }
      setFormValues({});
      setValidationErrors({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setSaving(false);
    }
  };

  // ── 4. Edit mode trigger ──────────────────────────────────────────────────
  const startEditRecord = (record: any, entityName: string) => {
    setEditingRecord({ id: record.id, entityName, data: record });
    const values: Record<string, any> = {};
    const entitySchema = entities?.find((e) => e.name === entityName);
    entitySchema?.fields.forEach((f) => {
      values[f.name] = record[f.name] ?? "";
    });
    setFormValues(values);
    setValidationErrors({});
  };

  const cancelEdit = () => {
    setEditingRecord(null);
    setFormValues({});
    setValidationErrors({});
  };

  // ── 5. Delete handler ─────────────────────────────────────────────────────
  const handleDeleteRecord = async (entityName: string, recordId: number) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    setSaving(true);
    // Optimistic delete
    const previousRecords = records[entityName] || [];
    setRecords((prev) => ({
      ...prev,
      [entityName]: (prev[entityName] || []).filter((r) => r.id !== recordId),
    }));
    try {
      const res = await fetch(`/api/ai-templates/${templateId}/records/${recordId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete record");
    } catch (err) {
      // Revert on error
      setRecords((prev) => ({ ...prev, [entityName]: previousRecords }));
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setSaving(false);
    }
  };

  // ── 6. Action triggering (e.g. toggle completion) ─────────────────────────
  const triggerAction = async (actionId: string, record: any) => {
    const action = actions?.find((a) => a.id === actionId);
    if (!action) return;

    const entityName = action.entity;
    const updateData: Record<string, any> = {};
    if (action.type === "update" && action.fields) {
      Object.entries(action.fields).forEach(([fKey, fVal]) => {
        if (fVal === "toggle") {
          updateData[fKey] = !record[fKey];
        } else {
          updateData[fKey] = fVal;
        }
      });
      // Optimistic update
      setRecords((prev) => ({
        ...prev,
        [entityName]: (prev[entityName] || []).map((r) => (r.id === record.id ? { ...r, ...updateData } : r)),
      }));
      try {
        const res = await fetch(`/api/ai-templates/${templateId}/records/${record.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: updateData }),
        });
        if (!res.ok) throw new Error("Action failed");
        const data = await res.json();
        setRecords((prev) => ({
          ...prev,
          [entityName]: (prev[entityName] || []).map((r) => (r.id === record.id ? data.record : r)),
        }));
      } catch (err) {
        fetchRecords();
        setError("Action failed to persist.");
      }
    } else if (action.type === "delete") {
      await handleDeleteRecord(entityName, record.id);
    }
  };

  // ── 7. Render dynamic stats widget ────────────────────────────────────────
  const renderStatsWidget = (widget: any, wIdx: number) => {
    const entityName = widget.entity;
    const entityRecords = records[entityName] || [];

    return (
      <div key={widget.id || `stats-${wIdx}`} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 my-4">
        {widget.items?.map((item: any, idx: number) => {
          // Apply widget filter if defined
          let filtered = entityRecords;
          if (item.filter) {
            filtered = entityRecords.filter((rec) => {
              return Object.entries(item.filter).every(([k, v]) => String(rec[k]) === String(v));
            });
          }

          let calculatedValue: string | number = 0;
          if (item.valueType === "count") {
            calculatedValue = filtered.length;
          } else if (item.field) {
            const values = filtered.map((r) => Number(r[item.field])).filter((v) => !isNaN(v));
            if (values.length > 0) {
              if (item.valueType === "sum") {
                calculatedValue = values.reduce((a, b) => a + b, 0);
              } else if (item.valueType === "avg") {
                calculatedValue = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
              } else if (item.valueType === "max") {
                calculatedValue = Math.max(...values);
              } else if (item.valueType === "min") {
                calculatedValue = Math.min(...values);
              }
            }
          }

          return (
            <div
              key={idx}
              className="flex items-center gap-3 rounded-xl border border-border bg-white/70 p-4 shadow-sm backdrop-blur-sm transition hover:shadow-md"
            >
              <div
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                style={{ backgroundColor: `${color}1a` }}
              >
                <Activity className="h-5 w-5" style={{ color }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold leading-tight text-foreground">{calculatedValue}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.label}</p>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── 8. Render progress widget ─────────────────────────────────────────────
  const renderProgressWidget = (widget: any, wIdx: number) => {
    const entityName = widget.entity;
    const entityRecords = records[entityName] || [];
    let progress = 0;
    if (entityRecords.length > 0) {
      if (widget.calculate === "percentage" && widget.filterField) {
        const completed = entityRecords.filter((r) => !!r[widget.filterField]).length;
        progress = Math.round((completed / entityRecords.length) * 100);
      } else if (widget.calculate === "sum_target" && widget.targetField && widget.targetValue) {
        const sum = entityRecords
          .map((r) => Number(r[widget.targetField!]))
          .filter((v) => !isNaN(v))
          .reduce((a, b) => a + b, 0);
        progress = Math.round((sum / widget.targetValue) * 100);
      }
    }

    const pct = Math.min(100, Math.max(0, progress));
    return (
      <div key={widget.id || `progress-${wIdx}`} className="rounded-xl border border-border bg-white/70 p-4 shadow-sm backdrop-blur-sm my-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">{widget.title}</span>
          <span className="text-xs font-bold tabular-nums text-muted-foreground">{pct}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
      </div>
    );
  };

  // ── 9. Render list/table widgets ──────────────────────────────────────────
  const renderListOrTableWidget = (widget: any, wIdx: number) => {
    const entityName = widget.entity;
    const entityRecords = records[entityName] || [];
    const query = (searchQueries[widget.id] || "").trim().toLowerCase();
    const widgetFilters = selectedFilters[widget.id] || {};

    // 1. Text Search filtering
    let items = entityRecords;
    if (query) {
      items = items.filter((r) => {
        return Object.values(r).some((v) => {
          if (typeof v === "string" || typeof v === "number") {
            return String(v).toLowerCase().includes(query);
          }
          return false;
        });
      });
    }

    // 2. Select Option filtering
    Object.entries(widgetFilters).forEach(([field, selectedVal]) => {
      if (selectedVal) {
        items = items.filter((r) => String(r[field]) === selectedVal);
      }
    });

    // Extract unique filter options for filter fields
    const getFilterOptions = (field: string) => {
      const vals = entityRecords.map((r) => r[field]).filter((v) => v !== undefined && v !== null && v !== "");
      return Array.from(new Set(vals)).map(String);
    };

    return (
      <div key={widget.id || `list-${wIdx}`} className="rounded-2xl border border-border bg-card/90 shadow-sm backdrop-blur-sm my-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-base font-bold text-foreground">{widget.title}</h3>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            {widget.searchable && (
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search records..."
                  value={searchQueries[widget.id] || ""}
                  onChange={(e) => setSearchQueries((prev) => ({ ...prev, [widget.id]: e.target.value }))}
                  className="h-8 w-44 rounded-lg border border-border bg-white pl-8 pr-3 text-xs text-foreground outline-none transition focus:ring-1 focus:ring-orange-300"
                />
              </div>
            )}

            {/* Filter Selects */}
            {widget.filterable &&
              widget.filterFields?.map((fField: string) => (
                <select
                  key={fField}
                  value={widgetFilters[fField] || ""}
                  onChange={(e) =>
                    setSelectedFilters((prev) => ({
                      ...prev,
                      [widget.id]: { ...(prev[widget.id] || {}), [fField]: e.target.value },
                    }))
                  }
                  className="h-8 rounded-lg border border-border bg-white px-2 text-xs text-muted-foreground outline-none transition focus:ring-1 focus:ring-orange-300"
                >
                  <option value="">All {fField}</option>
                  {getFilterOptions(fField).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ))}
          </div>
        </div>

        {items.length === 0 ? (
          <p className="text-sm italic text-muted-foreground py-6 text-center">No records found.</p>
        ) : widget.type === "table" ? (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {widget.displayFields?.map((h: string) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0 transition hover:bg-muted/20">
                    {widget.displayFields?.map((field: string) => (
                      <td key={field} className="px-4 py-2.5 text-sm text-foreground">
                        {typeof item[field] === "boolean" ? (
                          <span
                            className={cn(
                              "inline-flex h-2 w-2 rounded-full",
                              item[field] ? "bg-emerald-500" : "bg-slate-300"
                            )}
                          />
                        ) : (
                          String(item[field] ?? "")
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-right text-sm">
                      <div className="flex items-center justify-end gap-2">
                        {widget.actions?.map((actId: string) => {
                          const act = actions?.find((a) => a.id === actId);
                          if (!act) return null;
                          if (act.type === "update") {
                            return (
                              <button
                                key={actId}
                                onClick={() => triggerAction(actId, item)}
                                className="inline-flex items-center gap-1 rounded bg-muted hover:bg-muted/80 px-2 py-1 text-xs font-semibold text-muted-foreground transition"
                              >
                                {act.label}
                              </button>
                            );
                          }
                          return null;
                        })}
                        <button
                          onClick={() => startEditRecord(item, entityName)}
                          className="text-muted-foreground hover:text-foreground transition p-1"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRecord(entityName, item.id)}
                          className="text-muted-foreground hover:text-destructive transition p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              // Custom representation for checklist style vs general list item
              const isChecklist = widget.actions?.some((aId: string) => {
                const act = actions?.find((a) => a.id === aId);
                return act?.type === "update" && Object.values(act.fields || {}).includes("toggle");
              });

              const toggleActionId = widget.actions?.find((aId: string) => {
                const act = actions?.find((a) => a.id === aId);
                return act?.type === "update" && Object.values(act.fields || {}).includes("toggle");
              });

              // Check if completed/checked
              const isCompleted = Object.keys(item).some(
                (k) => (k === "completed" || k === "checked") && !!item[k]
              );

              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-white/50 p-3 hover:bg-white transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isChecklist && toggleActionId ? (
                      <button
                        onClick={() => triggerAction(toggleActionId, item)}
                        className={cn(
                          "grid h-5 w-5 shrink-0 place-items-center rounded border-2 transition-all duration-200",
                          isCompleted ? "border-transparent scale-105" : "border-border bg-white"
                        )}
                        style={isCompleted ? { backgroundColor: color, borderColor: color } : {}}
                      >
                        {isCompleted && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                      </button>
                    ) : (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
                    )}

                    <div className="min-w-0">
                      <span
                        className={cn(
                          "text-sm font-medium transition",
                          isCompleted ? "text-muted-foreground line-through" : "text-foreground"
                        )}
                      >
                        {item.name || item.title || item.label || Object.values(item)[0] || "Untitled"}
                      </span>
                      {widget.displayFields?.slice(1).map((df: string) => {
                        if (df === "completed" || df === "checked" || df === "id") return null;
                        return (
                          <span key={df} className="ml-2.5 text-[10px] text-muted-foreground border-l border-border pl-2">
                            {df}: {String(item[df] ?? "")}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {widget.actions?.map((actId: string) => {
                      const act = actions?.find((a) => a.id === actId);
                      if (!act || act.id === toggleActionId) return null;
                      if (act.type === "update") {
                        return (
                          <button
                            key={actId}
                            onClick={() => triggerAction(actId, item)}
                            className="inline-flex items-center gap-1 rounded bg-muted hover:bg-muted/80 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground transition"
                          >
                            {act.label}
                          </button>
                        );
                      }
                      return null;
                    })}
                    <button
                      onClick={() => startEditRecord(item, entityName)}
                      className="text-muted-foreground hover:text-foreground transition p-1"
                    >
                      <Edit className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteRecord(entityName, item.id)}
                      className="text-muted-foreground hover:text-destructive transition p-1"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  };

  // ── 10. Main Loading / Error rendering ────────────────────────────────────
  if (loading) {
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
          <p className="mt-1 text-xs text-muted-foreground">Fetching saved records</p>
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
        {onBack && (
          <button
            onClick={onBack}
            className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs text-muted-foreground transition hover:bg-muted mr-2"
          >
            ← Back
          </button>
        )}
        <AppIcon name={icon} color={color} size="lg" />

        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold tracking-tight text-foreground">{appName}</h2>
          <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {saving && (
            <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-600">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-xs font-medium text-amber-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-amber-500 hover:text-amber-800">
            Dismiss
          </button>
        </div>
      )}

      {/* ── Dashboard & CRUD Layout ────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5">
        <div className="mx-auto max-w-5xl space-y-4 pb-12">
          {/* Widgets Grid at Top */}
          {widgets?.some((w) => w.type === "stats") && (
            <div>{widgets.filter((w) => w.type === "stats").map(renderStatsWidget)}</div>
          )}

          {widgets?.some((w) => w.type === "progress") && (
            <div className="grid gap-4 sm:grid-cols-2">
              {widgets.filter((w) => w.type === "progress").map(renderProgressWidget)}
            </div>
          )}

          {/* Main workspace splits */}
          <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
            {/* Left: Dynamic Form CRUD */}
            <div className="space-y-4">
              {forms?.map((formConfig) => {
                const isEdit = editingRecord && editingRecord.entityName === formConfig.entity;
                return (
                  <div
                    key={formConfig.id}
                    className="rounded-2xl border border-border bg-card p-5 shadow-soft transition"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-foreground">
                        {isEdit ? `Edit ${entities?.find(e => e.name === formConfig.entity)?.label || "Item"}` : formConfig.title}
                      </h3>

                      {isEdit && (
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="text-xs text-muted-foreground hover:text-foreground transition underline"
                        >
                          Cancel Edit
                        </button>
                      )}
                    </div>

                    <form onSubmit={(e) => handleFormSubmit(e, formConfig)} className="space-y-3">
                      {formConfig.fields?.map((field: any) => {
                        const entitySchema = entities?.find((e) => e.name === formConfig.entity);
                        const schemaField = entitySchema?.fields.find((sf) => sf.name === field.name);
                        const label = field.label || schemaField?.label || field.name;
                        const type = field.type || schemaField?.type || "text";
                        const inputClass = cn(
                          "h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:ring-1 focus:ring-orange-300",
                          validationErrors[field.name] && "border-red-400 focus:ring-red-300"
                        );

                        return (
                          <div key={field.name} className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-foreground">
                              {label}
                              {field.required && <span className="ml-0.5 text-red-500">*</span>}
                            </label>

                            {type === "select" && schemaField?.options ? (
                              <select
                                value={formValues[field.name] ?? ""}
                                onChange={(e) => setFormValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                                className={inputClass}
                                required={field.required}
                              >
                                <option value="">{field.placeholder || "Select Option…"}</option>
                                {schemaField.options.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : type === "textarea" ? (
                              <textarea
                                value={formValues[field.name] ?? ""}
                                onChange={(e) => setFormValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                                placeholder={field.placeholder}
                                className={cn(inputClass, "h-auto resize-none py-2")}
                                rows={3}
                                required={field.required}
                              />
                            ) : type === "boolean" ? (
                              <label className="flex items-center gap-2 mt-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!formValues[field.name]}
                                  onChange={(e) => setFormValues((prev) => ({ ...prev, [field.name]: e.target.checked }))}
                                  className="rounded border-border text-orange-500 focus:ring-orange-300 h-4 w-4"
                                />
                                <span className="text-xs text-muted-foreground">{field.placeholder || "Active"}</span>
                              </label>
                            ) : (
                              <input
                                type={type === "number" ? "number" : type === "date" ? "date" : "text"}
                                value={formValues[field.name] ?? ""}
                                onChange={(e) => setFormValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                                placeholder={field.placeholder}
                                className={inputClass}
                                required={field.required}
                              />
                            )}

                            {validationErrors[field.name] && (
                              <span className="text-[10px] text-red-500 font-semibold mt-0.5">
                                {validationErrors[field.name]}
                              </span>
                            )}
                          </div>
                        );
                      })}

                      <div className="flex justify-end pt-1">
                        <button
                          type="submit"
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-[0.98]"
                          style={{ backgroundColor: color }}
                        >
                          <Plus className="h-4 w-4" />
                          {isEdit ? "Save Changes" : "Add"}
                        </button>
                      </div>
                    </form>
                  </div>
                );
              })}
            </div>

            {/* Right: Lists and Tables */}
            <div className="space-y-4">
              {widgets
                ?.filter((w) => w.type === "list" || w.type === "table")
                .map(renderListOrTableWidget)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}