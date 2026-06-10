"use client";

import * as React from "react";
import {
  Archive,
  Copy,
  Edit3,
  ExternalLink,
  Link2,
  Loader2,
  MessageCircle,
  Share2,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useOthers, useSelf } from "@liveblocks/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type PageRecord = {
  id: number;
  spaceId: number;
  userId: number;
  title: string;
  template: string;
  description: string | null;
  isFavorite: boolean;
  isArchived: boolean;
  commentsCount: number;
  linkedTasksCount: number;
  createdAt: string;
  updatedAt: string;
  updatedByName?: string;
};

type SpaceRecord = {
  id: number;
  name: string;
  color: string;
};

type Comment = {
  id: number;
  userId: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  authorName: string;
  authorEmail: string;
  authorImageUrl: string | null;
};

type LinkedTask = {
  id: number;
  title: string;
  boardId: number;
  priority: string;
  dueDate: string;
};

type AvailableTask = {
  id: number;
  title: string;
  boardId: number;
  priority: string;
  dueDate: string;
};

const PRESENCE_COLORS = [
  "#6366f1", "#8b5cf6", "#06b6d4", "#10b981",
  "#f59e0b", "#ef4444", "#ec4899", "#64748b",
];

function formatRelative(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function PageViewers({ max = 8 }: { max?: number }) {
  const self = useSelf();
  const others = useOthers();
  const all = [
    ...(self ? [{ connectionId: self.connectionId, info: self.info, isSelf: true }] : []),
    ...others.map((o) => ({ connectionId: o.connectionId, info: o.info, isSelf: false })),
  ];
  const visible = all.slice(0, max);
  const overflow = all.length - max;

  if (all.length === 0) {
    return <p className="text-xs text-muted-foreground">No one else is viewing right now.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {visible.map((viewer, i) => {
        const info = viewer.info as { name?: string; avatar?: string; email?: string } | undefined;
        const name = info?.name ?? info?.email ?? (viewer.isSelf ? "You" : "Collaborator");
        const avatar = info?.avatar;
        const color = PRESENCE_COLORS[i % PRESENCE_COLORS.length];
        return (
          <div key={viewer.connectionId} className="flex items-center gap-1.5 rounded-full bg-white px-2 py-1 shadow-sm">
            <div
              className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full text-[9px] font-bold text-white"
              style={{ backgroundColor: color }}
            >
              {avatar ? (
                <img src={avatar} alt={name} className="h-full w-full object-cover" />
              ) : (
                name.slice(0, 2).toUpperCase()
              )}
            </div>
            <span className="text-xs font-medium text-foreground">
              {viewer.isSelf ? "You" : name}
            </span>
          </div>
        );
      })}
      {overflow > 0 && (
        <span className="text-xs font-semibold text-muted-foreground">+{overflow}</span>
      )}
    </div>
  );
}

export function PageDetailPanel({
  page,
  space,
  currentUserId,
  onPageUpdated,
  onPageDuplicated,
  onPageDeleted,
  onNavigateToPage,
}: {
  page: PageRecord;
  space: SpaceRecord;
  currentUserId: number | null;
  onPageUpdated: (page: PageRecord) => void;
  onPageDuplicated: (page: PageRecord) => void;
  onPageDeleted: () => void;
  onNavigateToPage: (page: PageRecord) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [title, setTitle] = React.useState(page.title);
  const [description, setDescription] = React.useState(page.description ?? "");
  const [saving, setSaving] = React.useState(false);
  const [comments, setComments] = React.useState<Comment[]>([]);
  const [linkedTasks, setLinkedTasks] = React.useState<LinkedTask[]>([]);
  const [availableTasks, setAvailableTasks] = React.useState<AvailableTask[]>([]);
  const [newComment, setNewComment] = React.useState("");
  const [editingCommentId, setEditingCommentId] = React.useState<number | null>(null);
  const [editingCommentContent, setEditingCommentContent] = React.useState("");
  const [showTaskPicker, setShowTaskPicker] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setTitle(page.title);
    setDescription(page.description ?? "");
  }, [page.id, page.title, page.description]);

  const loadComments = React.useCallback(async () => {
    const res = await fetch(`/api/pages/${page.id}/comments`);
    if (res.ok) {
      const data = await res.json();
      setComments(data.comments ?? []);
    }
  }, [page.id]);

  const loadTasks = React.useCallback(async () => {
    const res = await fetch(`/api/pages/${page.id}/tasks`);
    if (res.ok) {
      const data = await res.json();
      setLinkedTasks(data.tasks ?? []);
    }
  }, [page.id]);

  React.useEffect(() => {
    void loadComments();
    void loadTasks();
  }, [loadComments, loadTasks]);

  React.useEffect(() => {
    if (!showTaskPicker) return;
    void (async () => {
      const res = await fetch("/api/pages/tasks/available");
      if (res.ok) {
        const data = await res.json();
        setAvailableTasks(data.tasks ?? []);
      }
    })();
  }, [showTaskPicker]);

  function scheduleDescriptionSave(value: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveDescription(value);
    }, 800);
  }

  async function saveDescription(value: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/pages/${page.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: value || null }),
      });
      if (res.ok) {
        const updated = await res.json();
        onPageUpdated(updated);
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveTitleAndDescription() {
    setSaving(true);
    try {
      const res = await fetch(`/api/pages/${page.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() || "Untitled Page", description: description || null }),
      });
      if (res.ok) {
        const updated = await res.json();
        onPageUpdated(updated);
        setEditing(false);
        toast.success("Page saved");
      } else {
        toast.error("Failed to save page");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleAddComment() {
    if (!newComment.trim()) return;
    const res = await fetch(`/api/pages/${page.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newComment }),
    });
    if (res.ok) {
      setNewComment("");
      await loadComments();
      const pageRes = await fetch(`/api/pages/${page.id}`);
      if (pageRes.ok) onPageUpdated(await pageRes.json());
    } else {
      toast.error("Failed to add comment");
    }
  }

  async function handleUpdateComment(commentId: number) {
    const res = await fetch(`/api/pages/${page.id}/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editingCommentContent }),
    });
    if (res.ok) {
      setEditingCommentId(null);
      await loadComments();
    } else {
      toast.error("Failed to update comment");
    }
  }

  async function handleDeleteComment(commentId: number) {
    const res = await fetch(`/api/pages/${page.id}/comments/${commentId}`, { method: "DELETE" });
    if (res.ok) {
      await loadComments();
      const pageRes = await fetch(`/api/pages/${page.id}`);
      if (pageRes.ok) onPageUpdated(await pageRes.json());
    }
  }

  async function attachTask(taskId: number) {
    const res = await fetch(`/api/pages/${page.id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId }),
    });
    if (res.ok) {
      const data = await res.json();
      setLinkedTasks(data.tasks ?? []);
      setShowTaskPicker(false);
      const pageRes = await fetch(`/api/pages/${page.id}`);
      if (pageRes.ok) onPageUpdated(await pageRes.json());
      toast.success("Task linked");
    }
  }

  async function detachTask(taskId: number) {
    const res = await fetch(`/api/pages/${page.id}/tasks`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId }),
    });
    if (res.ok) {
      const data = await res.json();
      setLinkedTasks(data.tasks ?? []);
      const pageRes = await fetch(`/api/pages/${page.id}`);
      if (pageRes.ok) onPageUpdated(await pageRes.json());
    }
  }

  async function handleDuplicate() {
    const res = await fetch(`/api/pages/${page.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "duplicate" }),
    });
    if (res.ok) {
      const copy = await res.json();
      onPageDuplicated(copy);
      toast.success("Page duplicated");
    } else {
      toast.error("Failed to duplicate");
    }
  }

  async function handleArchive() {
    const res = await fetch(`/api/pages/${page.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isArchived: !page.isArchived }),
    });
    if (res.ok) {
      const updated = await res.json();
      onPageUpdated(updated);
      toast.success(page.isArchived ? "Page restored" : "Page archived");
    }
  }

  async function handleDelete() {
    const res = await fetch(`/api/pages/${page.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Page deleted");
      onPageDeleted();
    } else {
      toast.error("Failed to delete page");
    }
    setDeleteOpen(false);
  }

  function handleShare() {
    const url = `${window.location.origin}${window.location.pathname}?space=${space.id}&page=${page.id}`;
    void navigator.clipboard.writeText(url);
    toast.success("Share link copied to clipboard");
  }

  function handleExportMarkdown() {
    const md = `# ${page.title}\n\n**Space:** ${space.name}\n**Template:** ${page.template}\n**Updated:** ${page.updatedAt}\n\n${description || "_No description_"}\n\n## Comments (${comments.length})\n\n${comments.map((c) => `- **${c.authorName}:** ${c.content}`).join("\n")}\n\n## Linked Tasks (${linkedTasks.length})\n\n${linkedTasks.map((t) => `- ${t.title} (${t.priority})`).join("\n")}`;
    downloadFile(`${page.title}.md`, md, "text/markdown");
  }

  function handleExportJson() {
    const payload = { page, space: { id: space.id, name: space.name }, comments, linkedTasks };
    downloadFile(`${page.title}.json`, JSON.stringify(payload, null, 2), "application/json");
  }

  function downloadFile(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename.replace(/[^\w.-]+/g, "_");
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Export downloaded");
  }

  const linkedTaskIds = new Set(linkedTasks.map((t) => t.id));

  return (
    <div className="mx-auto max-w-2xl space-y-6 rounded-2xl border border-border bg-white p-6 shadow-soft">
      {editing ? (
        <div className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2 text-2xl font-bold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            placeholder="Write a description…"
            className="w-full resize-y rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void saveTitleAndDescription()}
              disabled={saving}
              className="h-8 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setTitle(page.title); setDescription(page.description ?? ""); }}
              className="h-8 rounded-lg border border-border px-4 text-xs font-medium hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <h2 className="text-2xl font-bold text-foreground">{page.title}</h2>
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              scheduleDescriptionSave(e.target.value);
            }}
            rows={4}
            placeholder="Add a description…"
            className="w-full resize-y rounded-lg border border-transparent bg-muted/30 px-3 py-2 text-sm leading-relaxed text-muted-foreground outline-none transition focus:border-indigo-200 focus:bg-white focus:text-foreground"
          />
          {saving && (
            <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving…
            </p>
          )}
        </>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-sky-500" />
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Comments</p>
          </div>
          <p className="mt-1 text-sm font-semibold">{comments.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-emerald-500" />
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Linked Tasks</p>
          </div>
          <p className="mt-1 text-sm font-semibold">{linkedTasks.length}</p>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">
          Last edited {formatRelative(page.updatedAt)}
          {page.updatedByName && (
            <> · by <span className="font-medium text-foreground">{page.updatedByName}</span></>
          )}
        </p>
      </div>

      <div className="rounded-xl bg-indigo-50 p-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-indigo-500" />
          <p className="text-xs font-semibold text-indigo-700">Currently viewing this page</p>
        </div>
        <div className="mt-2">
          <PageViewers max={8} />
        </div>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-xs font-semibold text-foreground">Comments</p>
        <div className="flex gap-2">
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment…"
            className="h-9 flex-1 rounded-lg border border-border px-3 text-sm outline-none focus:border-indigo-400"
            onKeyDown={(e) => { if (e.key === "Enter") void handleAddComment(); }}
          />
          <button
            type="button"
            onClick={() => void handleAddComment()}
            className="h-9 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            Post
          </button>
        </div>
        <div className="space-y-2">
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-indigo-100 text-[9px] font-bold text-indigo-700">
                    {comment.authorImageUrl ? (
                      <img src={comment.authorImageUrl} alt={comment.authorName} className="h-full w-full object-cover" />
                    ) : (
                      comment.authorName.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{comment.authorName}</p>
                    <p className="text-[10px] text-muted-foreground">{formatRelative(comment.createdAt)}</p>
                  </div>
                </div>
                {currentUserId === comment.userId && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => { setEditingCommentId(comment.id); setEditingCommentContent(comment.content); }}
                      className="text-[10px] text-indigo-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteComment(comment.id)}
                      className="text-[10px] text-destructive hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
              {editingCommentId === comment.id ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={editingCommentContent}
                    onChange={(e) => setEditingCommentContent(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-border px-2 py-1 text-sm outline-none"
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void handleUpdateComment(comment.id)} className="text-xs text-indigo-600">Save</button>
                    <button type="button" onClick={() => setEditingCommentId(null)} className="text-xs text-muted-foreground">Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-foreground">{comment.content}</p>
              )}
            </div>
          ))}
          {comments.length === 0 && (
            <p className="text-xs text-muted-foreground">No comments yet.</p>
          )}
        </div>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground">Linked tasks</p>
          <button
            type="button"
            onClick={() => setShowTaskPicker((v) => !v)}
            className="text-xs font-medium text-indigo-600 hover:underline"
          >
            {showTaskPicker ? "Cancel" : "Attach task"}
          </button>
        </div>
        {showTaskPicker && (
          <div className="max-h-40 overflow-y-auto rounded-lg border border-border p-2">
            {availableTasks.filter((t) => !linkedTaskIds.has(t.id)).length === 0 ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">No available tasks from your boards.</p>
            ) : (
              availableTasks
                .filter((t) => !linkedTaskIds.has(t.id))
                .map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => void attachTask(task.id)}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-muted/50"
                  >
                    <span className="truncate">{task.title}</span>
                    <span className="text-[10px] text-muted-foreground">{task.priority}</span>
                  </button>
                ))
            )}
          </div>
        )}
        <div className="space-y-1">
          {linkedTasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">{task.title}</p>
                <p className="text-[10px] text-muted-foreground">{task.priority} · due {task.dueDate}</p>
              </div>
              <button
                type="button"
                onClick={() => void detachTask(task.id)}
                className="text-xs text-destructive hover:underline"
              >
                Detach
              </button>
            </div>
          ))}
          {linkedTasks.length === 0 && (
            <p className="text-xs text-muted-foreground">No linked tasks.</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <ActionButton icon={Edit3} label="Edit" onClick={() => setEditing(true)} />
        <ActionButton icon={Share2} label="Share" onClick={handleShare} />
        <ActionButton icon={Copy} label="Duplicate" onClick={() => void handleDuplicate()} />
        <ActionButton icon={ExternalLink} label="Export MD" onClick={handleExportMarkdown} />
        <ActionButton icon={ExternalLink} label="Export JSON" onClick={handleExportJson} />
        <ActionButton icon={Archive} label={page.isArchived ? "Restore" : "Archive"} onClick={() => void handleArchive()} />
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-3 text-xs font-medium text-destructive transition hover:bg-red-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>

      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-6 shadow-soft">
            <h3 className="text-base font-semibold">Delete page?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              &quot;{page.title}&quot; will be permanently deleted. This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteOpen(false)} className="h-9 rounded-lg border border-border px-4 text-sm hover:bg-muted">Cancel</button>
              <button type="button" onClick={() => void handleDelete()} className="h-9 rounded-lg bg-destructive px-4 text-sm font-semibold text-white hover:bg-destructive/90">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-medium text-muted-foreground shadow-soft transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
