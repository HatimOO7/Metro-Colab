"use client";

import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  Gauge,
  LayoutDashboard,
  Loader2,
  LogOut,
  Palette,
  PenLine,
  Plus,
  Search,
  Settings,
  Shield,
  StickyNote,
  Tag,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { UserButton, useClerk } from "@clerk/nextjs";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type DashboardData = {
  profile: { id: number; name: string; email: string; imageUrl: string | null; createdAt: string | null };
  preferences: {
    theme: "system" | "light" | "dark";
    notifications: boolean;
    defaultCalendarView: "month" | "week";
    defaultTaskPriority: "Low" | "Medium" | "High";
    autoSave: boolean;
    privacy: { showProfileToCollaborators: boolean; allowUserSearch: boolean };
  };
  categories: Category[];
  stats: Record<string, number>;
  featureMetrics: Array<{ key: string; label: string; value: number; detail: string }>;
  taskAnalytics: { total: number; completed: number; pending: number; overdue: number; progress: number };
  recentActivity: Array<{ id: string; type: string; module: string; title: string; createdAt: string | null }>;
  upcomingSchedule: Array<{ id: string; title: string; date: string | null; time: string | null; categoryColor: string; type: string }>;
  recentResources: Array<{ id: string; resourceType: string; title: string; module: string; lastViewedAt: string | null; lastEditedAt: string | null }>;
  collaboration: CollaborationData;
};

type Category = {
  id: number;
  scope: "calendar" | "task" | "note" | "reminder";
  name: string;
  color: string;
  icon: string;
};

type CollaborationData = {
  resources: Array<{
    id: string;
    resourceId: number;
    type: "space" | "kanban" | "whiteboard";
    name: string;
    role: string;
    members: Array<{ email: string; name?: string; role?: string }>;
    pendingInvites: Array<{ email?: string; invitedEmail?: string; name?: string }>;
  }>;
  invitations: Array<{ id: number; type: "space" | "kanban" | "whiteboard"; name: string; inviter: string }>;
};

type DashboardPageProps = {
  onCreateTask: () => void;
  onCreateNote: () => Promise<void>;
  onCreateReminder: () => void;
  onOpenWhiteboard: () => void;
  onCreateTemplate: () => void;
};

const colorClass: Record<string, string> = {
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
  rose: "bg-rose-500",
  amber: "bg-amber-500",
  coral: "bg-coral-600",
  fuchsia: "bg-fuchsia-500",
  indigo: "bg-indigo-500",
};

function formatDate(value: string | null) {
  if (!value) return "No date";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatDateTime(value: string | null) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

async function readJson(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? "Request failed");
  return payload;
}

export function DashboardPage({
  onCreateTask,
  onCreateNote,
  onCreateReminder,
  onOpenWhiteboard,
  onCreateTemplate,
}: DashboardPageProps) {
  const { signOut } = useClerk();
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = React.useState({ scope: "calendar", name: "", color: "sky", icon: "Tag" });
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteResourceId, setInviteResourceId] = React.useState("");
  const [userSearch, setUserSearch] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<Array<{ email: string; name: string }>>([]);
  const [deletePassword, setDeletePassword] = React.useState("");
  const [deletePreview, setDeletePreview] = React.useState<any | null>(null);

  const reload = React.useCallback(async () => {
    setError(null);
    try {
      const payload = await readJson(await fetch("/api/dashboard", { cache: "no-store" }));
      setData(payload as DashboardData);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Unable to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  React.useEffect(() => {
    if (userSearch.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      try {
        const payload = await readJson(await fetch(`/api/users/search?q=${encodeURIComponent(userSearch)}`));
        setSearchResults(payload.users ?? []);
      } catch {
        setSearchResults([]);
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [userSearch]);

  async function saveProfile(formData: FormData) {
    setSaving("profile");
    try {
      await readJson(
        await fetch("/api/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.get("name"),
            email: formData.get("email"),
          }),
        })
      );
      await reload();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save profile");
    } finally {
      setSaving(null);
    }
  }

  async function saveAvatar(formData: FormData) {
    setSaving("avatar");
    try {
      await readJson(
        await fetch("/api/me/avatar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: formData.get("imageUrl") }),
        })
      );
      await reload();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save avatar");
    } finally {
      setSaving(null);
    }
  }

  async function savePreferences(patch: Partial<DashboardData["preferences"]>) {
    if (!data) return;
    setSaving("preferences");
    try {
      const payload = await readJson(
        await fetch("/api/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data.preferences, ...patch }),
        })
      );
      setData({ ...data, preferences: payload.preferences });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save preferences");
    } finally {
      setSaving(null);
    }
  }

  async function createCategory() {
    if (!categoryDraft.name.trim()) return;
    setSaving("category");
    try {
      await readJson(
        await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(categoryDraft),
        })
      );
      setCategoryDraft({ scope: "calendar", name: "", color: "sky", icon: "Tag" });
      await reload();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to create category");
    } finally {
      setSaving(null);
    }
  }

  async function deleteCategory(id: number) {
    setSaving(`category-${id}`);
    try {
      await readJson(
        await fetch("/api/categories", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        })
      );
      await reload();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to delete category");
    } finally {
      setSaving(null);
    }
  }

  async function respondToInvitation(type: string, id: number, action: "accept" | "reject") {
    const path =
      type === "space"
        ? `/api/spaces/invitations/${id}/${action}`
        : type === "whiteboard"
          ? `/api/whiteboards/invitations/${id}/${action}`
          : `/api/kanban/invitations/${id}/${action}`;
    setSaving(`${action}-${type}-${id}`);
    try {
      await readJson(await fetch(path, { method: "POST" }));
      await reload();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update invitation");
    } finally {
      setSaving(null);
    }
  }

  async function sendInvitation() {
    if (!inviteEmail.trim() || !inviteResourceId) return;
    const resource = data?.collaboration.resources.find((item) => item.id === inviteResourceId);
    if (!resource) return;
    const base =
      resource.type === "space"
        ? `/api/spaces/${resource.resourceId}/share`
        : resource.type === "whiteboard"
          ? `/api/whiteboards/${resource.resourceId}/share`
          : `/api/kanban/boards/${resource.resourceId}/share`;
    setSaving("invite");
    try {
      await readJson(
        await fetch(base, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: inviteEmail.trim().toLowerCase() }),
        })
      );
      setInviteEmail("");
      await reload();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to send invitation");
    } finally {
      setSaving(null);
    }
  }

  async function removeCollaborator(resourceId: string, email: string) {
    const resource = data?.collaboration.resources.find((item) => item.id === resourceId);
    if (!resource) return;
    const base =
      resource.type === "space"
        ? `/api/spaces/${resource.resourceId}/share`
        : resource.type === "whiteboard"
          ? `/api/whiteboards/${resource.resourceId}/share`
          : `/api/kanban/boards/${resource.resourceId}/share`;
    setSaving(`remove-${resourceId}-${email}`);
    try {
      await readJson(
        await fetch(base, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        })
      );
      await reload();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to remove collaborator");
    } finally {
      setSaving(null);
    }
  }

  async function previewDeletion() {
    setSaving("delete-preview");
    try {
      setDeletePreview(await readJson(await fetch("/api/me/delete/preview", { method: "POST" })));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to preview deletion");
    } finally {
      setSaving(null);
    }
  }

  async function deleteAccount() {
    setSaving("delete");
    try {
      await readJson(
        await fetch("/api/me/delete", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passwordConfirmation: deletePassword }),
        })
      );
      await signOut();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to delete account");
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 px-4 py-5 lg:px-6">
        <div className="h-36 animate-pulse rounded-lg border border-border bg-card" />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-32 animate-pulse rounded-lg border border-border bg-card" />
          <div className="h-32 animate-pulse rounded-lg border border-border bg-card" />
          <div className="h-32 animate-pulse rounded-lg border border-border bg-card" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-4 py-5 lg:px-6">
        <div className="rounded-lg border border-destructive/25 bg-red-50 p-4 text-sm text-destructive">
          {error ?? "Dashboard is unavailable."}
          <Button type="button" variant="outline" className="ml-3 h-8 bg-white text-xs" onClick={() => void reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const quickActions = [
    { label: "Create Task", icon: ClipboardCheck, action: onCreateTask },
    { label: "Create Note", icon: StickyNote, action: () => void onCreateNote() },
    { label: "Create Reminder", icon: Bell, action: onCreateReminder },
    { label: "Open Whiteboard", icon: PenLine, action: onOpenWhiteboard },
    { label: "Create Template", icon: LayoutDashboard, action: onCreateTemplate },
  ];

  return (
    <div className="min-w-0 space-y-4 px-4 py-5 lg:px-6">
      {error && (
        <div className="rounded-lg border border-destructive/25 bg-red-50 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
        <div className="rounded-lg border border-border bg-card p-4 shadow-soft">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                {data.profile.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.profile.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserRound className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Overview</p>
                <h2 className="truncate text-2xl font-semibold">{data.profile.name}</h2>
                <p className="truncate text-sm text-muted-foreground">{data.profile.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center sm:min-w-80">
              <Stat label="Tasks" value={data.stats.tasks} />
              <Stat label="Notes" value={data.stats.notes} />
              <Stat label="Collaborations" value={data.stats.collaborations} />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-soft">
          <p className="text-sm font-semibold">Quick Actions</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button key={action.label} type="button" variant="outline" className="h-10 justify-start rounded-lg bg-white text-xs" onClick={action.action}>
                  <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
                  {action.label}
                </Button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.featureMetrics.map((metric) => (
          <div key={metric.key} className="rounded-lg border border-border bg-card p-4 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-semibold">{metric.label}</p>
              <Gauge className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="mt-3 text-3xl font-semibold">{metric.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="Recent Activity" icon={CheckCircle2} empty="No activity has been recorded yet.">
            {data.recentActivity.map((item) => (
              <Row key={item.id} title={item.title} meta={`${item.module} · ${item.type} · ${formatDateTime(item.createdAt)}`} />
            ))}
          </Panel>
          <Panel title="Upcoming Schedule" icon={CalendarDays} empty="No upcoming events, reminders, or deadlines.">
            {data.upcomingSchedule.map((item) => (
              <Row
                key={item.id}
                title={item.title}
                meta={`${formatDate(item.date)}${item.time ? ` · ${item.time}` : ""} · ${item.type}`}
                marker={item.categoryColor}
              />
            ))}
          </Panel>
          <Panel title="Recent Resources" icon={FileText} empty="Open or edit resources and they will appear here.">
            {data.recentResources.map((item) => (
              <Row key={item.id} title={item.title} meta={`${item.module} · viewed ${formatDateTime(item.lastViewedAt)}`} />
            ))}
          </Panel>
          <div className="rounded-lg border border-border bg-card p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Task Analytics</p>
              <ClipboardCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Stat label="Total" value={data.taskAnalytics.total} />
              <Stat label="Completed" value={data.taskAnalytics.completed} />
              <Stat label="Pending" value={data.taskAnalytics.pending} />
              <Stat label="Overdue" value={data.taskAnalytics.overdue} />
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs font-semibold">
                <span>Progress</span>
                <span>{data.taskAnalytics.progress}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${data.taskAnalytics.progress}%` }} />
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Data Export</p>
              <Download className="h-4 w-4 text-sky-600" aria-hidden="true" />
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Export your user-specific workspace data as JSON.</p>
            <Button asChild className="mt-3 h-9 w-full rounded-lg text-xs">
              <a href="/api/export">Export data</a>
            </Button>
          </div>
        </aside>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Category Management</p>
            <Tag className="h-4 w-4 text-amber-600" aria-hidden="true" />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <select value={categoryDraft.scope} onChange={(event) => setCategoryDraft({ ...categoryDraft, scope: event.target.value })} className="h-9 rounded-lg border border-input bg-white px-3 text-xs">
              <option value="calendar">Calendar Events</option>
              <option value="task">Tasks</option>
              <option value="note">Notes</option>
              <option value="reminder">Reminders</option>
            </select>
            <Input value={categoryDraft.name} onChange={(event) => setCategoryDraft({ ...categoryDraft, name: event.target.value })} placeholder="Category name" className="h-9 text-xs" />
            <select value={categoryDraft.color} onChange={(event) => setCategoryDraft({ ...categoryDraft, color: event.target.value })} className="h-9 rounded-lg border border-input bg-white px-3 text-xs">
              {Object.keys(colorClass).map((color) => <option key={color} value={color}>{color}</option>)}
            </select>
            <Button type="button" className="h-9 rounded-lg text-xs" onClick={() => void createCategory()} disabled={saving === "category"}>
              {saving === "category" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {data.categories.map((category) => (
              <div key={category.id} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-border bg-white p-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={cn("h-3 w-3 rounded-full", colorClass[category.color] ?? "bg-slate-500")} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{category.name}</p>
                    <p className="text-[11px] capitalize text-muted-foreground">{category.scope}</p>
                  </div>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-lg" onClick={() => void deleteCategory(category.id)} disabled={saving === `category-${category.id}`}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Collaboration</p>
            <UsersRound className="h-4 w-4 text-indigo-600" aria-hidden="true" />
          </div>

          <div className="mt-4 space-y-2">
            {data.collaboration.invitations.length === 0 ? (
              <EmptyState text="No pending invitations." />
            ) : (
              data.collaboration.invitations.map((invite) => (
                <div key={`${invite.type}-${invite.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-white p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{invite.name}</p>
                    <p className="text-[11px] text-muted-foreground">{invite.type} · invited by {invite.inviter}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="h-8 bg-white text-xs" onClick={() => void respondToInvitation(invite.type, invite.id, "reject")}>Reject</Button>
                    <Button type="button" className="h-8 text-xs" onClick={() => void respondToInvitation(invite.type, invite.id, "accept")}>Accept</Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <select value={inviteResourceId} onChange={(event) => setInviteResourceId(event.target.value)} className="h-9 min-w-0 rounded-lg border border-input bg-white px-3 text-xs">
              <option value="">Select resource</option>
              {data.collaboration.resources.filter((resource) => resource.role === "owner").map((resource) => (
                <option key={resource.id} value={resource.id}>{resource.name} ({resource.type})</option>
              ))}
            </select>
            <Input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="Invite by email" className="h-9 text-xs" />
            <Button type="button" className="h-9 rounded-lg text-xs" onClick={() => void sendInvitation()} disabled={saving === "invite"}>Send</Button>
          </div>

          <div className="mt-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search existing users" className="h-9 pl-9 text-xs" />
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 rounded-lg border border-border bg-white p-2">
                {searchResults.map((user) => (
                  <button key={user.email} type="button" className="flex w-full flex-col rounded-md px-2 py-1.5 text-left hover:bg-muted" onClick={() => setInviteEmail(user.email)}>
                    <span className="text-xs font-semibold">{user.name}</span>
                    <span className="text-[11px] text-muted-foreground">{user.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 space-y-3">
            {data.collaboration.resources.map((resource) => (
              <div key={resource.id} className="rounded-lg border border-border bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{resource.name}</p>
                    <p className="text-[11px] text-muted-foreground">{resource.type} · {resource.role}</p>
                  </div>
                  {resource.role !== "owner" && (
                    <Button type="button" variant="outline" className="h-8 bg-white text-xs" onClick={() => void removeCollaborator(resource.id, data.profile.email)}>
                      Leave
                    </Button>
                  )}
                </div>
                {(resource.members.length > 0 || resource.pendingInvites.length > 0) && (
                  <div className="mt-2 space-y-1">
                    {resource.members.map((member) => (
                      <div key={member.email} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate">{member.name ?? member.email}</span>
                        {resource.role === "owner" && (
                          <button type="button" className="text-destructive hover:underline" onClick={() => void removeCollaborator(resource.id, member.email)}>
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                    {resource.pendingInvites.map((invite) => (
                      <p key={invite.email ?? invite.invitedEmail} className="truncate text-[11px] text-muted-foreground">
                        Pending: {invite.name ?? invite.email ?? invite.invitedEmail}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-destructive/25 bg-red-50 p-4 shadow-soft">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <p className="text-sm font-semibold">Danger Zone</p>
        </div>
        <p className="mt-2 text-sm leading-6 text-red-900/80">
          Deleting your account removes local app data, leaves shared collaborations, revokes pending invitations, and then deletes the auth account.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <Input type="password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} placeholder="Confirm with password" className="h-9 bg-white text-xs" />
          <Button type="button" variant="outline" className="h-9 bg-white text-xs" onClick={() => void previewDeletion()} disabled={saving === "delete-preview"}>
            Preview deletion
          </Button>
          <Button type="button" className="h-9 bg-destructive text-xs text-destructive-foreground hover:bg-destructive/90" onClick={() => void deleteAccount()} disabled={saving === "delete" || !deletePreview?.canDelete}>
            Delete account
          </Button>
        </div>
        {deletePreview && (
          <div className="mt-3 rounded-lg border border-red-200 bg-white p-3 text-xs leading-5 text-red-900">
            {deletePreview.canDelete ? "Deletion checks passed." : "Deletion is blocked until ownership transfer requirements are resolved."}
            {deletePreview.blockers?.map((blocker: { id: number; name: string; reason: string }) => (
              <p key={blocker.id} className="mt-1 font-medium">{blocker.name}: {blocker.reason}</p>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function SettingsPage() {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    setError(null);
    try {
      const payload = await readJson(await fetch("/api/dashboard", { cache: "no-store" }));
      setData(payload as DashboardData);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Unable to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  async function saveProfile(formData: FormData) {
    setSaving("profile");
    try {
      await readJson(
        await fetch("/api/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.get("name"),
            email: formData.get("email"),
          }),
        })
      );
      await reload();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save profile");
    } finally {
      setSaving(null);
    }
  }

  async function savePreferences(patch: Partial<DashboardData["preferences"]>) {
    if (!data) return;
    setSaving("preferences");
    try {
      const payload = await readJson(
        await fetch("/api/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data.preferences, ...patch }),
        })
      );
      setData({ ...data, preferences: payload.preferences });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save preferences");
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 px-4 py-5 lg:px-6">
        <div className="h-72 animate-pulse rounded-lg border border-border bg-card" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-4 py-5 lg:px-6">
        <div className="rounded-lg border border-destructive/25 bg-red-50 p-4 text-sm text-destructive">
          {error ?? "Settings are unavailable."}
          <Button type="button" variant="outline" className="ml-3 h-8 bg-white text-xs" onClick={() => void reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-5 lg:px-6">
      {error && (
        <div className="mb-4 rounded-lg border border-destructive/25 bg-red-50 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <SettingsPanel data={data} saving={saving} saveProfile={saveProfile} savePreferences={savePreferences} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-white p-3">
      <p className="text-xl font-semibold">{value}</p>
      <p className="mt-1 truncate text-[11px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-border bg-white/80 p-4 text-sm text-muted-foreground">{text}</div>;
}

function Panel({
  title,
  icon: Icon,
  empty,
  children,
}: {
  title: string;
  icon: React.ElementType;
  empty: string;
  children: React.ReactNode[];
}) {
  const items = React.Children.toArray(children);
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{title}</p>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="mt-4 space-y-2">{items.length > 0 ? items : <EmptyState text={empty} />}</div>
    </div>
  );
}

function Row({ title, meta, marker }: { title: string; meta: string; marker?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-white p-3">
      <span className={cn("h-3 w-3 shrink-0 rounded-full", marker ? colorClass[marker] ?? "bg-slate-500" : "bg-slate-300")} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{title}</p>
        <p className="truncate text-[11px] text-muted-foreground">{meta}</p>
      </div>
    </div>
  );
}

function SettingsPanel({
  data,
  saving,
  saveProfile,
  savePreferences,
}: {
  data: DashboardData;
  saving: string | null;
  saveProfile: (formData: FormData) => Promise<void>;
  savePreferences: (patch: Partial<DashboardData["preferences"]>) => Promise<void>;
}) {
  const { signOut } = useClerk();

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Settings</p>
        <Settings className="h-4 w-4 text-slate-600" aria-hidden="true" />
      </div>

      <form action={(formData) => void saveProfile(formData)} className="mt-4 space-y-3">
        <div>
          <Label className="text-xs">Name</Label>
          <Input name="name" defaultValue={data.profile.name} className="mt-1 h-9 text-xs" />
        </div>
        <div>
          <Label className="text-xs">Email</Label>
          <Input name="email" defaultValue={data.profile.email} className="mt-1 h-9 text-xs" />
        </div>
        <Button type="submit" className="h-9 w-full rounded-lg text-xs" disabled={saving === "profile"}>
          {saving === "profile" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Update profile
        </Button>
      </form>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-border bg-white p-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Profile picture</p>
          <p className="mt-1 text-xs text-muted-foreground">Managed by Clerk</p>
        </div>
        <UserButton userProfileMode="modal" />
      </div>

      <div className="mt-4 space-y-3 border-t border-border pt-4">
        <PreferenceSelect label="Default calendar view" value={data.preferences.defaultCalendarView} values={["month", "week"]} onChange={(defaultCalendarView) => void savePreferences({ defaultCalendarView: defaultCalendarView as "month" | "week" })} />
        <PreferenceSelect label="Default task priority" value={data.preferences.defaultTaskPriority} values={["Low", "Medium", "High"]} onChange={(defaultTaskPriority) => void savePreferences({ defaultTaskPriority: defaultTaskPriority as "Low" | "Medium" | "High" })} />
        <ToggleRow icon={Bell} label="Notifications" checked={data.preferences.notifications} onChange={(notifications) => void savePreferences({ notifications })} />
        <ToggleRow icon={Palette} label="Auto-save" checked={data.preferences.autoSave} onChange={(autoSave) => void savePreferences({ autoSave })} />
        <ToggleRow icon={Shield} label="Profile visible to collaborators" checked={data.preferences.privacy.showProfileToCollaborators} onChange={(showProfileToCollaborators) => void savePreferences({ privacy: { ...data.preferences.privacy, showProfileToCollaborators } })} />
      </div>

      <div className="mt-4 grid gap-2 border-t border-border pt-4 sm:grid-cols-2">
        <Button type="button" variant="outline" className="h-9 bg-white text-xs" onClick={() => void signOut()}>
          <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
          Logout
        </Button>
      </div>
    </div>
  );
}

function PreferenceSelect({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 rounded-lg border border-input bg-white px-3 text-xs">
        {values.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </label>
  );
}

function ToggleRow({ icon: Icon, label, checked, onChange }: { icon: React.ElementType; label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold">
      <span className="flex min-w-0 items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4" />
    </label>
  );
}
