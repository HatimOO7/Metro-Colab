"use client";

import * as React from "react";
import {
  Archive,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Edit3,
  ExternalLink,
  FileText,
  FolderOpen,
  Grid3x3,
  Heart,
  LayoutList,
  Link2,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Share2,
  Star,
  StarOff,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { LiveblocksProvider, RoomProvider, useOthers, useSelf, useUpdateMyPresence, ClientSideSuspense } from "@liveblocks/react";
import { toast } from "sonner";
import { PageDetailPanel } from "@/components/page-detail-panel";
import { pageInitialStorage } from "@/lib/page-room-storage";
import { SpaceInviteDialog } from "@/components/space-invite-dialog";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type SpaceColor =
  | "indigo"
  | "violet"
  | "sky"
  | "emerald"
  | "coral"
  | "amber"
  | "fuchsia"
  | "slate";

type SpaceRecord = {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  color: string;
  isFavorite: boolean;
  isArchived: boolean;
  sharedEmails: string[];
  createdAt: string;
  updatedAt: string;
  ownerEmail?: string;
  pageCount?: number;
};

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
  updatedByEmail?: string;
};

type ViewMode = "all-spaces" | "space-detail" | "page-detail";
type FilterTab = "all" | "favorites" | "recent" | "archived";
type SortKey = "updated" | "name" | "pages" | "favorites";
type LayoutMode = "grid" | "list";

// ─── Color palette ────────────────────────────────────────────────────────────

const SPACE_COLORS: { key: SpaceColor; bg: string; light: string; icon: string; border: string }[] = [
  { key: "indigo", bg: "bg-indigo-500", light: "bg-indigo-50", icon: "text-indigo-600", border: "border-indigo-200" },
  { key: "violet", bg: "bg-violet-500", light: "bg-violet-50", icon: "text-violet-600", border: "border-violet-200" },
  { key: "sky", bg: "bg-sky-500", light: "bg-sky-50", icon: "text-sky-600", border: "border-sky-200" },
  { key: "emerald", bg: "bg-emerald-500", light: "bg-emerald-50", icon: "text-emerald-600", border: "border-emerald-200" },
  { key: "coral", bg: "bg-coral-600", light: "bg-coral-100", icon: "text-coral-600", border: "border-orange-200" },
  { key: "amber", bg: "bg-amber-500", light: "bg-amber-50", icon: "text-amber-600", border: "border-amber-200" },
  { key: "fuchsia", bg: "bg-fuchsia-500", light: "bg-fuchsia-50", icon: "text-fuchsia-600", border: "border-fuchsia-200" },
  { key: "slate", bg: "bg-slate-500", light: "bg-slate-50", icon: "text-slate-600", border: "border-slate-200" },
];

function getColorConfig(color: string) {
  return SPACE_COLORS.find((c) => c.key === color) ?? SPACE_COLORS[0];
}

// ─── Template config ───────────────────────────────────────────────────────────

const TEMPLATES = [
  { value: "Blank Page", badge: "bg-slate-100 text-slate-600" },
  { value: "Project Plan", badge: "bg-blue-100 text-blue-700" },
  { value: "Meeting Notes", badge: "bg-emerald-100 text-emerald-700" },
  { value: "PRD", badge: "bg-violet-100 text-violet-700" },
  { value: "Research Notes", badge: "bg-amber-100 text-amber-700" },
  { value: "Task Plan", badge: "bg-coral-100 text-coral-700" },
];

function getTemplateBadge(template: string) {
  return TEMPLATES.find((t) => t.value === template)?.badge ?? "bg-slate-100 text-slate-600";
}

// ─── Time helpers ──────────────────────────────────────────────────────────────

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

// ─── Liveblocks Presence Avatars ───────────────────────────────────────────────

const PRESENCE_COLORS = [
  "#6366f1", "#8b5cf6", "#06b6d4", "#10b981",
  "#f59e0b", "#ef4444", "#ec4899", "#64748b",
];

function PresenceAvatars({ max = 4 }: { max?: number }) {
  const self = useSelf();
  const others = useOthers();
  const all = [
    ...(self ? [self] : []),
    ...others,
  ];
  const visible = all.slice(0, max);
  const overflow = all.length - max;

  if (all.length === 0) return null;

  return (
    <div className="flex items-center gap-1" title={`${all.length} viewing`}>
      <div className="flex -space-x-1.5">
        {visible.map((other, i) => {
          const info = other.info as { name?: string; avatar?: string; email?: string } | undefined;
          const isSelf = self?.connectionId === other.connectionId;
          const name = isSelf ? "You" : (info?.name ?? info?.email ?? "Collaborator");
          const avatar = info?.avatar;
          const color = PRESENCE_COLORS[other.connectionId % PRESENCE_COLORS.length];
          return (
            <div
              key={other.connectionId}
              title={name}
              className="relative h-6 w-6 rounded-full border-2 border-white shadow-sm overflow-hidden flex items-center justify-center text-[9px] font-bold text-white"
              style={{ backgroundColor: color }}
            >
              {avatar ? (
                <img src={avatar} alt={name} className="h-full w-full object-cover" />
              ) : (
                name.slice(0, 2).toUpperCase()
              )}
            </div>
          );
        })}
      </div>
      {overflow > 0 && (
        <span className="text-[10px] font-semibold text-muted-foreground">+{overflow}</span>
      )}
      <span className="ml-1 h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]" />
    </div>
  );
}

// ─── Live Cursor ──────────────────────────────────────────────────────────────

function LiveCursors() {
  const others = useOthers();
  return (
    <>
      {others.map((other) => {
        const cursor = other.presence?.cursor;
        if (!cursor) return null;
        const info = other.info as { name?: string } | undefined;
        const name = info?.name ?? "User";
        const color = PRESENCE_COLORS[other.connectionId % PRESENCE_COLORS.length];
        return (
          <div
            key={other.connectionId}
            className="pointer-events-none fixed z-50 transition-transform duration-75"
            style={{ left: cursor.x, top: cursor.y }}
          >
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
              <path d="M0 0L0 16L4.5 11.5L7.5 19L9.5 18L6.5 10H13L0 0Z" fill={color} />
            </svg>
            <span
              className="ml-3 mt-0.5 block rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm"
              style={{ backgroundColor: color }}
            >
              {name}
            </span>
          </div>
        );
      })}
    </>
  );
}

// ─── Dropdown Menu (simple) ────────────────────────────────────────────────────

function DropdownItem({
  icon: Icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition hover:bg-muted",
        danger && "text-destructive hover:bg-red-50"
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {label}
    </button>
  );
}

function SpaceMoreMenu({
  space,
  onRename,
  onChangeColor,
  onAddPage,
  onInvite,
  onDuplicate,
  onFavorite,
  onArchive,
  onDelete,
}: {
  space: SpaceRecord;
  onRename: () => void;
  onChangeColor: () => void;
  onAddPage: () => void;
  onInvite: () => void;
  onDuplicate: () => void;
  onFavorite: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-muted hover:text-foreground"
        aria-label="Space options"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-50 min-w-[176px] rounded-xl border border-border bg-white p-1 shadow-soft">
          <DropdownItem icon={Edit3} label="Rename Space" onClick={() => { setOpen(false); onRename(); }} />
          <DropdownItem icon={FolderOpen} label="Change Color" onClick={() => { setOpen(false); onChangeColor(); }} />
          <DropdownItem icon={Plus} label="Add Page" onClick={() => { setOpen(false); onAddPage(); }} />
          <DropdownItem icon={Users} label="Invite Collaborators" onClick={() => { setOpen(false); onInvite(); }} />
          <DropdownItem icon={Copy} label="Duplicate" onClick={() => { setOpen(false); onDuplicate(); }} />
          <div className="my-1 h-px bg-border" />
          <DropdownItem icon={space.isFavorite ? StarOff : Star} label={space.isFavorite ? "Unfavorite" : "Favorite"} onClick={() => { setOpen(false); onFavorite(); }} />
          <DropdownItem icon={Archive} label={space.isArchived ? "Unarchive" : "Archive"} onClick={() => { setOpen(false); onArchive(); }} />
          <div className="my-1 h-px bg-border" />
          <DropdownItem icon={Trash2} label="Delete Space" danger onClick={() => { setOpen(false); onDelete(); }} />
        </div>
      )}
    </div>
  );
}

function PageMoreMenu({
  page,
  spaceId,
  onRename,
  onFavorite,
  onArchive,
  onDuplicate,
  onShare,
  onExport,
  onDelete,
}: {
  page: PageRecord;
  spaceId: number;
  onRename: () => void;
  onFavorite: () => void;
  onArchive: () => void;
  onDuplicate: () => void;
  onShare: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-muted"
        aria-label="Page options"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-50 min-w-[164px] rounded-xl border border-border bg-white p-1 shadow-soft">
          <DropdownItem icon={Edit3} label="Rename" onClick={() => { setOpen(false); onRename(); }} />
          <DropdownItem icon={Copy} label="Duplicate" onClick={() => { setOpen(false); onDuplicate(); }} />
          <DropdownItem icon={Share2} label="Share" onClick={() => { setOpen(false); onShare(); }} />
          <DropdownItem icon={ExternalLink} label="Export" onClick={() => { setOpen(false); onExport(); }} />
          <div className="my-1 h-px bg-border" />
          <DropdownItem icon={page.isFavorite ? StarOff : Star} label={page.isFavorite ? "Unfavorite" : "Favorite"} onClick={() => { setOpen(false); onFavorite(); }} />
          <DropdownItem icon={Archive} label={page.isArchived ? "Unarchive" : "Archive"} onClick={() => { setOpen(false); onArchive(); }} />
          <div className="my-1 h-px bg-border" />
          <DropdownItem icon={Trash2} label="Delete" danger onClick={() => { setOpen(false); onDelete(); }} />
        </div>
      )}
    </div>
  );
}

// ─── Modal Base ────────────────────────────────────────────────────────────────

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Create Space Modal ────────────────────────────────────────────────────────

function CreateSpaceModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (space: SpaceRecord) => void;
}) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [color, setColor] = React.useState<SpaceColor>("indigo");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Space name is required."); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, color }),
      });
      if (!res.ok) throw new Error(await res.text());
      const space = await res.json() as SpaceRecord;
      onCreated(space);
      setName(""); setDescription(""); setColor("indigo");
      onClose();
      toast.success("Space created!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create space.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create New Space">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-foreground">Space Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Product Design"
            autoFocus
            className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-foreground">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this space for?"
            rows={3}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none"
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-semibold text-foreground">Color</label>
          <div className="flex flex-wrap gap-2">
            {SPACE_COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setColor(c.key)}
                className={cn(
                  "h-7 w-7 rounded-full transition",
                  c.bg,
                  color === c.key && "ring-2 ring-offset-2 ring-indigo-500"
                )}
                title={c.key}
              />
            ))}
          </div>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="h-9 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-9 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create Space"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Change Color Modal ────────────────────────────────────────────────────────

function ChangeColorModal({
  open,
  space,
  onClose,
  onUpdated,
}: {
  open: boolean;
  space: SpaceRecord | null;
  onClose: () => void;
  onUpdated: (space: SpaceRecord) => void;
}) {
  const [color, setColor] = React.useState<SpaceColor>("indigo");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (space) setColor(space.color as SpaceColor);
  }, [space]);

  async function handleSave() {
    if (!space) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/spaces/${space.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color }),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json() as SpaceRecord;
      onUpdated(updated);
      onClose();
      toast.success("Color updated!");
    } catch {
      toast.error("Failed to update color.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Change Space Color">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          {SPACE_COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setColor(c.key)}
              className={cn("h-9 w-9 rounded-full transition", c.bg, color === c.key && "ring-2 ring-offset-2 ring-indigo-500")}
              title={c.key}
            />
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="h-9 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {saving ? "Saving…" : "Save Color"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Rename Modal ──────────────────────────────────────────────────────────────

function RenameModal({
  open,
  label,
  initialValue,
  onClose,
  onSave,
}: {
  open: boolean;
  label: string;
  initialValue: string;
  onClose: () => void;
  onSave: (newName: string) => Promise<void>;
}) {
  const [value, setValue] = React.useState(initialValue);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => { if (open) setValue(initialValue); }, [open, initialValue]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) { setError("Name cannot be empty."); return; }
    setSaving(true); setError(null);
    try {
      await onSave(value.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Rename ${label}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted">Cancel</button>
          <button type="submit" disabled={saving} className="h-9 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Create Page Modal ─────────────────────────────────────────────────────────

function CreatePageModal({
  open,
  spaces,
  defaultSpaceId,
  onClose,
  onCreated,
}: {
  open: boolean;
  spaces: SpaceRecord[];
  defaultSpaceId?: number;
  onClose: () => void;
  onCreated: (page: PageRecord) => void;
}) {
  const [title, setTitle] = React.useState("");
  const [spaceId, setSpaceId] = React.useState<number | "">(defaultSpaceId ?? "");
  const [template, setTemplate] = React.useState("Blank Page");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setTitle("");
      setTemplate("Blank Page");
      setSpaceId(defaultSpaceId ?? (spaces[0]?.id ?? ""));
      setError(null);
    }
  }, [open, defaultSpaceId, spaces]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Page title is required."); return; }
    if (!spaceId) { setError("Please select a space."); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), spaceId, template }),
      });
      if (!res.ok) throw new Error(await res.text());
      const page = await res.json() as PageRecord;
      onCreated(page);
      onClose();
      toast.success("Page created!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create page.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create New Page">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-foreground">Page Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Q3 Roadmap"
            autoFocus
            className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-foreground">Add to Space</label>
          <select
            value={spaceId}
            onChange={(e) => setSpaceId(e.target.value ? Number(e.target.value) : "")}
            className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">Select a space…</option>
            {spaces.filter((s) => !s.isArchived).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-foreground">Template</label>
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          >
            {TEMPLATES.map((t) => (
              <option key={t.value} value={t.value}>{t.value}</option>
            ))}
          </select>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="h-9 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted">Cancel</button>
          <button type="submit" disabled={saving} className="h-9 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {saving ? "Creating…" : "Create Page"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Space Card (Grid) ─────────────────────────────────────────────────────────

function SpaceCard({
  space,
  onClick,
  onRename,
  onChangeColor,
  onAddPage,
  onInvite,
  onDuplicate,
  onFavorite,
  onArchive,
  onDelete,
}: {
  space: SpaceRecord;
  onClick: () => void;
  onRename: () => void;
  onChangeColor: () => void;
  onAddPage: () => void;
  onInvite: () => void;
  onDuplicate: () => void;
  onFavorite: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const col = getColorConfig(space.color);

  return (
    <SpaceCardInner
      space={space}
      col={col}
      onClick={onClick}
      onRename={onRename}
      onChangeColor={onChangeColor}
      onAddPage={onAddPage}
      onInvite={onInvite}
      onDuplicate={onDuplicate}
      onFavorite={onFavorite}
      onArchive={onArchive}
      onDelete={onDelete}
    />
  );
}

function SpaceCardInner({
  space, col, onClick, onRename, onChangeColor, onAddPage, onInvite, onDuplicate, onFavorite, onArchive, onDelete,
}: {
  space: SpaceRecord;
  col: ReturnType<typeof getColorConfig>;
  onClick: () => void;
  onRename: () => void;
  onChangeColor: () => void;
  onAddPage: () => void;
  onInvite: () => void;
  onDuplicate: () => void;
  onFavorite: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="group relative flex cursor-pointer flex-col rounded-2xl border border-border bg-white p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-[0_8px_30px_hsl(239_84%_67%/0.12)]"
    >
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div className={cn("grid h-11 w-11 place-items-center rounded-xl", col.light)}>
          <FolderOpen className={cn("h-6 w-6", col.icon)} />
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onFavorite(); }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-muted"
            title={space.isFavorite ? "Unfavorite" : "Favorite"}
          >
            <Star className={cn("h-3.5 w-3.5", space.isFavorite && "fill-amber-400 text-amber-400")} />
          </button>
          <SpaceMoreMenu
            space={space}
            onRename={onRename}
            onChangeColor={onChangeColor}
            onAddPage={onAddPage}
            onInvite={onInvite}
            onDuplicate={onDuplicate}
            onFavorite={onFavorite}
            onArchive={onArchive}
            onDelete={onDelete}
          />
        </div>
      </div>

      {/* Content */}
      <div className="mt-3 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{space.name}</p>
        {space.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{space.description}</p>
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <FileText className="h-3 w-3" />
            {space.pageCount ?? 0} page{space.pageCount !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatRelative(space.updatedAt)}
          </span>
        </div>
      </div>

      {/* Color accent bar */}
      <div className={cn("absolute bottom-0 left-4 right-4 h-0.5 rounded-full opacity-0 transition-opacity group-hover:opacity-100", col.bg)} />
    </div>
  );
}

// ─── Space List Row ────────────────────────────────────────────────────────────

function SpaceListRow({
  space,
  onClick,
  onRename,
  onChangeColor,
  onAddPage,
  onInvite,
  onDuplicate,
  onFavorite,
  onArchive,
  onDelete,
}: {
  space: SpaceRecord;
  onClick: () => void;
  onRename: () => void;
  onChangeColor: () => void;
  onAddPage: () => void;
  onInvite: () => void;
  onDuplicate: () => void;
  onFavorite: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const col = getColorConfig(space.color);

  return (
      <div
        onClick={onClick}
        className="group flex cursor-pointer items-center gap-4 rounded-xl border border-border bg-white px-4 py-3 shadow-soft transition hover:border-indigo-200 hover:bg-indigo-50/30"
      >
        <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", col.light)}>
          <FolderOpen className={cn("h-4.5 w-4.5", col.icon)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{space.name}</p>
          {space.description && (
            <p className="truncate text-[11px] text-muted-foreground">{space.description}</p>
          )}
        </div>
        <span className="hidden w-16 text-right text-[11px] text-muted-foreground sm:block">
          {space.pageCount ?? 0} pages
        </span>
        <span className="hidden w-20 text-right text-[11px] text-muted-foreground md:block">
          {formatRelative(space.updatedAt)}
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onFavorite(); }}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-muted"
        >
          <Star className={cn("h-3.5 w-3.5", space.isFavorite && "fill-amber-400 text-amber-400")} />
        </button>
        <SpaceMoreMenu
          space={space}
          onRename={onRename}
          onChangeColor={onChangeColor}
          onAddPage={onAddPage}
          onInvite={onInvite}
          onDuplicate={onDuplicate}
          onFavorite={onFavorite}
          onArchive={onArchive}
          onDelete={onDelete}
        />
      </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, description, action }: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-indigo-50 shadow-[0_4px_14px_hsl(239_84%_67%/0.15)]">
        <Icon className="h-8 w-8 text-indigo-400" />
      </div>
      <p className="mt-4 text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1.5 max-w-xs text-xs text-muted-foreground leading-relaxed">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ─── All Spaces View ───────────────────────────────────────────────────────────

function AllSpacesView({
  spaces: allSpaces,
  loading,
  currentUserId,
  onSpaceClick,
  onSpaceUpdated,
  onSpaceDeleted,
  onSpaceCreated,
  onRefresh,
}: {
  spaces: SpaceRecord[];
  loading: boolean;
  currentUserId: number | null;
  onSpaceClick: (space: SpaceRecord) => void;
  onSpaceUpdated: (space: SpaceRecord) => void;
  onSpaceDeleted: (id: number) => void;
  onSpaceCreated: (space: SpaceRecord) => void;
  onRefresh: () => void;
}) {
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<FilterTab>("all");
  const [sort, setSort] = React.useState<SortKey>("updated");
  const [layout, setLayout] = React.useState<LayoutMode>("grid");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [renameTarget, setRenameTarget] = React.useState<SpaceRecord | null>(null);
  const [colorTarget, setColorTarget] = React.useState<SpaceRecord | null>(null);
  const [createPageOpen, setCreatePageOpen] = React.useState(false);
  const [createPageSpaceId, setCreatePageSpaceId] = React.useState<number | undefined>(undefined);
  const [inviteTarget, setInviteTarget] = React.useState<SpaceRecord | null>(null);

  const filtered = React.useMemo(() => {
    let list = [...allSpaces];
    // Filter tab
    if (filter === "favorites") list = list.filter((s) => s.isFavorite && !s.isArchived);
    else if (filter === "recent") list = list.filter((s) => !s.isArchived).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 20);
    else if (filter === "archived") list = list.filter((s) => s.isArchived);
    else list = list.filter((s) => !s.isArchived);
    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q));
    }
    // Sort
    if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "pages") list.sort((a, b) => (b.pageCount ?? 0) - (a.pageCount ?? 0));
    else if (sort === "favorites") list.sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite));
    else list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return list;
  }, [allSpaces, filter, search, sort]);

  async function handleFavorite(space: SpaceRecord) {
    const res = await fetch(`/api/spaces/${space.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFavorite: !space.isFavorite }),
    });
    if (res.ok) onSpaceUpdated({ ...space, isFavorite: !space.isFavorite });
  }

  async function handleArchive(space: SpaceRecord) {
    const res = await fetch(`/api/spaces/${space.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isArchived: !space.isArchived }),
    });
    if (res.ok) { onSpaceUpdated({ ...space, isArchived: !space.isArchived }); toast.success(space.isArchived ? "Space restored" : "Space archived"); }
  }

  async function handleDelete(space: SpaceRecord) {
    if (!confirm(`Delete "${space.name}"? All pages inside will be permanently removed.`)) return;
    const res = await fetch(`/api/spaces/${space.id}`, { method: "DELETE" });
    if (res.ok) { onSpaceDeleted(space.id); toast.success("Space deleted"); }
    else toast.error("Failed to delete space.");
  }

  async function handleDuplicate(space: SpaceRecord) {
    const res = await fetch(`/api/spaces/${space.id}/duplicate`, { method: "POST" });
    if (res.ok) {
      const copy = await res.json() as SpaceRecord;
      onSpaceCreated({ ...copy, pageCount: 0 });
      toast.success("Space duplicated!");
    } else {
      toast.error("Failed to duplicate space.");
    }
  }

  async function handleRename(newName: string, space: SpaceRecord) {
    const res = await fetch(`/api/spaces/${space.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    if (res.ok) { const updated = await res.json() as SpaceRecord; onSpaceUpdated(updated); toast.success("Renamed!"); }
    else throw new Error("Failed to rename space.");
  }

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "Active" },
    { key: "favorites", label: "Favorites" },
    { key: "recent", label: "Recently Opened" },
    { key: "archived", label: "Archived" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="border-b border-border bg-white/80 px-5 py-4 backdrop-blur lg:px-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-500">Workspace</p>
            <h1 className="mt-0.5 text-2xl font-semibold text-foreground">All Spaces</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {allSpaces.filter((s) => !s.isArchived).length} space{allSpaces.filter((s) => !s.isArchived).length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-[0_4px_14px_hsl(239_84%_67%/0.3)] transition hover:bg-indigo-700 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            New Space
          </button>
        </div>

        {/* Search + toolbar */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex h-9 flex-1 items-center gap-2 rounded-xl border border-border bg-white px-3 text-xs text-muted-foreground shadow-soft sm:max-w-xs">
            <Search className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search spaces or pages…"
              className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
          <div className="flex items-center gap-2 ml-auto">
            {/* Sort */}
            <div className="relative">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-9 appearance-none rounded-xl border border-border bg-white pl-3 pr-8 text-xs font-medium text-foreground outline-none shadow-soft focus:border-indigo-300"
              >
                <option value="updated">Recently Updated</option>
                <option value="name">Name</option>
                <option value="pages">Most Pages</option>
                <option value="favorites">Favorites</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            </div>
            {/* Layout toggle */}
            <div className="flex h-9 rounded-xl border border-border bg-white p-1 shadow-soft">
              <button
                type="button"
                onClick={() => setLayout("grid")}
                className={cn("flex h-7 w-7 items-center justify-center rounded-lg transition", layout === "grid" ? "bg-indigo-100 text-indigo-600" : "text-muted-foreground hover:text-foreground")}
                title="Grid view"
              >
                <Grid3x3 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setLayout("list")}
                className={cn("flex h-7 w-7 items-center justify-center rounded-lg transition", layout === "list" ? "bg-indigo-100 text-indigo-600" : "text-muted-foreground hover:text-foreground")}
                title="List view"
              >
                <LayoutList className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="mt-3 flex gap-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={cn(
                "h-7 rounded-lg px-3 text-[11px] font-semibold transition",
                filter === tab.key
                  ? "bg-indigo-100 text-indigo-700"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-5 lg:px-7">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title={filter === "archived" ? "No archived spaces" : search ? "No spaces found" : "No spaces yet"}
            description={
              filter === "archived"
                ? "Archived spaces will appear here."
                : search
                  ? "Try a different search term."
                  : "Create your first space to organize pages and collaborate with your team."
            }
            action={
              !search && filter === "all" ? (
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="inline-flex h-9 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4" />
                  Create first space
                </button>
              ) : undefined
            }
          />
        ) : layout === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((space) => (
              <SpaceCard
                key={space.id}
                space={space}
                onClick={() => onSpaceClick(space)}
                onRename={() => setRenameTarget(space)}
                onChangeColor={() => setColorTarget(space)}
                onAddPage={() => { setCreatePageSpaceId(space.id); setCreatePageOpen(true); }}
                onInvite={() => setInviteTarget(space)}
                onDuplicate={() => void handleDuplicate(space)}
                onFavorite={() => void handleFavorite(space)}
                onArchive={() => void handleArchive(space)}
                onDelete={() => void handleDelete(space)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {/* List header */}
            <div className="hidden grid-cols-[1fr_80px_100px_80px_40px] items-center px-4 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground sm:grid">
              <span>Name</span>
              <span className="text-right">Pages</span>
              <span className="text-right">Updated</span>
              <span className="text-right">Active</span>
              <span />
            </div>
            {filtered.map((space) => (
              <SpaceListRow
                key={space.id}
                space={space}
                onClick={() => onSpaceClick(space)}
                onRename={() => setRenameTarget(space)}
                onChangeColor={() => setColorTarget(space)}
                onAddPage={() => { setCreatePageSpaceId(space.id); setCreatePageOpen(true); }}
                onInvite={() => setInviteTarget(space)}
                onDuplicate={() => void handleDuplicate(space)}
                onFavorite={() => void handleFavorite(space)}
                onArchive={() => void handleArchive(space)}
                onDelete={() => void handleDelete(space)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateSpaceModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={onSpaceCreated} />
      <ChangeColorModal
        open={!!colorTarget}
        space={colorTarget}
        onClose={() => setColorTarget(null)}
        onUpdated={(updated) => { onSpaceUpdated(updated); setColorTarget(null); }}
      />
      <RenameModal
        open={!!renameTarget}
        label="Space"
        initialValue={renameTarget?.name ?? ""}
        onClose={() => setRenameTarget(null)}
        onSave={(name) => renameTarget ? handleRename(name, renameTarget) : Promise.resolve()}
      />
      <CreatePageModal
        open={createPageOpen}
        spaces={allSpaces}
        defaultSpaceId={createPageSpaceId}
        onClose={() => setCreatePageOpen(false)}
        onCreated={() => { onRefresh(); }}
      />
      {inviteTarget && (
        <SpaceInviteDialog
          open={!!inviteTarget}
          onOpenChange={(open) => { if (!open) setInviteTarget(null); }}
          spaceId={inviteTarget.id}
          spaceName={inviteTarget.name}
          isOwner={currentUserId !== null && inviteTarget.userId === currentUserId}
        />
      )}
    </div>
  );
}

// ─── Pages Table ───────────────────────────────────────────────────────────────

function PagesTable({
  pages: allPages,
  loading,
  onPageClick,
  onPageUpdated,
  onPageDeleted,
  onPageCreated,
  space,
  allSpaces,
}: {
  pages: PageRecord[];
  loading: boolean;
  onPageClick: (page: PageRecord) => void;
  onPageUpdated: (page: PageRecord) => void;
  onPageDeleted: (id: number) => void;
  onPageCreated: (page: PageRecord) => void;
  space: SpaceRecord;
  allSpaces: SpaceRecord[];
}) {
  const [createOpen, setCreateOpen] = React.useState(false);
  const [renameTarget, setRenameTarget] = React.useState<PageRecord | null>(null);
  const [pageFilter, setPageFilter] = React.useState<"active" | "archived" | "all">("active");

  async function handleFavorite(page: PageRecord) {
    const res = await fetch(`/api/pages/${page.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFavorite: !page.isFavorite }),
    });
    if (res.ok) onPageUpdated({ ...page, isFavorite: !page.isFavorite });
  }

  async function handleArchive(page: PageRecord) {
    const res = await fetch(`/api/pages/${page.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isArchived: !page.isArchived }),
    });
    if (res.ok) { onPageUpdated({ ...page, isArchived: !page.isArchived }); toast.success(page.isArchived ? "Page restored" : "Page archived"); }
  }

  async function handleDuplicate(page: PageRecord) {
    const res = await fetch(`/api/pages/${page.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "duplicate" }),
    });
    if (res.ok) { const copy = await res.json() as PageRecord; onPageCreated(copy); toast.success("Page duplicated!"); }
    else toast.error("Failed to duplicate page.");
  }

  async function handleDelete(page: PageRecord) {
    if (!confirm(`Delete "${page.title}"?`)) return;
    const res = await fetch(`/api/pages/${page.id}`, { method: "DELETE" });
    if (res.ok) { onPageDeleted(page.id); toast.success("Page deleted"); }
    else toast.error("Failed to delete page.");
  }

  async function handleRename(newTitle: string, page: PageRecord) {
    const res = await fetch(`/api/pages/${page.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    });
    if (res.ok) { const updated = await res.json() as PageRecord; onPageUpdated(updated); toast.success("Renamed!"); }
    else throw new Error("Failed to rename page.");
  }

  const visiblePages = allPages.filter((p) => {
    if (pageFilter === "archived") return p.isArchived;
    if (pageFilter === "active") return !p.isArchived;
    return true;
  });

  function handleShare(page: PageRecord) {
    const url = `${window.location.origin}${window.location.pathname}?space=${space.id}&page=${page.id}`;
    void navigator.clipboard.writeText(url);
    toast.success("Share link copied");
  }

  async function handleExport(page: PageRecord) {
    const res = await fetch(`/api/pages/${page.id}`);
    if (!res.ok) { toast.error("Failed to export"); return; }
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${page.title.replace(/[^\w.-]+/g, "_")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Export downloaded");
  }

  return (
    <>
      <div className="flex items-center justify-between px-5 pb-3 pt-1 lg:px-7">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-muted-foreground">
            {visiblePages.length} page{visiblePages.length !== 1 ? "s" : ""}
          </p>
          <div className="flex gap-1">
            {(["active", "archived", "all"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setPageFilter(key)}
                className={cn(
                  "h-6 rounded-md px-2 text-[10px] font-semibold capitalize transition",
                  pageFilter === key ? "bg-indigo-100 text-indigo-700" : "text-muted-foreground hover:bg-muted"
                )}
              >
                {key}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-indigo-600 px-3 text-xs font-semibold text-white shadow-[0_2px_8px_hsl(239_84%_67%/0.25)] transition hover:bg-indigo-700"
        >
          <Plus className="h-3.5 w-3.5" />
          New Page
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
        </div>
      ) : visiblePages.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No pages yet"
          description="Create your first page to start collaborating on documents inside this space."
          action={
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Create first page
            </button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border mx-5 mb-5 bg-white shadow-soft lg:mx-7">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_120px_140px_120px_80px_40px] items-center border-b border-border bg-muted/40 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            <span>Page Name</span>
            <span className="hidden sm:block">Template</span>
            <span className="hidden md:block">Last Updated</span>
            <span className="hidden lg:block">Updated By</span>
            <span className="text-center">Fav</span>
            <span />
          </div>
          {visiblePages.map((page, index) => (
            <div
              key={page.id}
              onClick={() => onPageClick(page)}
              className={cn(
                "group grid grid-cols-[1fr_120px_140px_120px_80px_40px] cursor-pointer items-center px-4 py-3 text-sm transition hover:bg-indigo-50/40",
                index !== 0 && "border-t border-border"
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <FileText className="h-4 w-4 shrink-0 text-indigo-400" />
                <span className="truncate font-medium text-foreground">{page.title}</span>
              </div>
              <div className="hidden sm:block">
                <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold", getTemplateBadge(page.template))}>
                  {page.template}
                </span>
              </div>
              <span className="hidden text-[11px] text-muted-foreground md:block">
                {formatRelative(page.updatedAt)}
              </span>
              <span className="hidden truncate text-[11px] text-muted-foreground lg:block">
                {page.updatedByName ?? "—"}
              </span>
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); void handleFavorite(page); }}
                  className="flex h-6 w-6 items-center justify-center rounded-md transition hover:bg-muted"
                >
                  <Star className={cn("h-3.5 w-3.5", page.isFavorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground opacity-0 group-hover:opacity-100")} />
                </button>
              </div>
              <div className="flex justify-end">
                <PageMoreMenu
                  page={page}
                  spaceId={space.id}
                  onRename={() => setRenameTarget(page)}
                  onFavorite={() => void handleFavorite(page)}
                  onArchive={() => void handleArchive(page)}
                  onDuplicate={() => void handleDuplicate(page)}
                  onShare={() => handleShare(page)}
                  onExport={() => void handleExport(page)}
                  onDelete={() => void handleDelete(page)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <CreatePageModal
        open={createOpen}
        spaces={allSpaces}
        defaultSpaceId={space.id}
        onClose={() => setCreateOpen(false)}
        onCreated={onPageCreated}
      />
      <RenameModal
        open={!!renameTarget}
        label="Page"
        initialValue={renameTarget?.title ?? ""}
        onClose={() => setRenameTarget(null)}
        onSave={(title) => renameTarget ? handleRename(title, renameTarget) : Promise.resolve()}
      />
    </>
  );
}

// ─── Space Detail View ─────────────────────────────────────────────────────────

function SpaceDetailView({
  space,
  allSpaces,
  currentUserId,
  onBack,
  onSpaceUpdated,
  onNavigateToPage,
}: {
  space: SpaceRecord;
  allSpaces: SpaceRecord[];
  currentUserId: number | null;
  onBack: () => void;
  onSpaceUpdated: (s: SpaceRecord) => void;
  onNavigateToPage: (page: PageRecord) => void;
}) {
  const [pages, setPages] = React.useState<PageRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const col = getColorConfig(space.color);

  React.useEffect(() => {
    async function loadPages() {
      setLoading(true);
      try {
        const res = await fetch(`/api/pages?spaceId=${space.id}`);
        if (res.ok) setPages(await res.json());
      } finally {
        setLoading(false);
      }
    }
    void loadPages();
  }, [space.id]);

  return (
    <RoomProvider id={`space-${space.id}`} initialPresence={{ cursor: null, spaceId: space.id }}>
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Header */}
        <div className="border-b border-border bg-white/80 px-5 py-4 backdrop-blur lg:px-7">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium transition hover:bg-indigo-50 hover:text-indigo-600"
            >
              <ArrowLeft className="h-3 w-3" />
              All Spaces
            </button>
            <ChevronRight className="h-3 w-3" />
            <span className="font-semibold text-foreground">{space.name}</span>
          </nav>

          {/* Space title row */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("grid h-10 w-10 place-items-center rounded-xl", col.light)}>
                <FolderOpen className={cn("h-5 w-5", col.icon)} />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">{space.name}</h1>
                {space.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{space.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <PresenceAvatars max={5} />
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground hover:bg-indigo-50 hover:text-indigo-600"
              >
                <Users className="h-3.5 w-3.5" />
                Invite
              </button>
              <button
                type="button"
                onClick={async () => {
                  const res = await fetch(`/api/spaces/${space.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isFavorite: !space.isFavorite }) });
                  if (res.ok) onSpaceUpdated({ ...space, isFavorite: !space.isFavorite });
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-amber-50"
                title={space.isFavorite ? "Unfavorite" : "Favorite"}
              >
                <Star className={cn("h-4 w-4", space.isFavorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
              </button>
            </div>
          </div>
        </div>

        <SpaceInviteDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          spaceId={space.id}
          spaceName={space.name}
          isOwner={currentUserId !== null && space.userId === currentUserId}
        />

        {/* Pages table */}
        <div className="flex-1 overflow-y-auto pt-5">
          <PagesTable
            pages={pages}
            loading={loading}
            space={space}
            allSpaces={allSpaces}
            onPageClick={onNavigateToPage}
            onPageUpdated={(page) => setPages((prev) => prev.map((p) => (p.id === page.id ? page : p)))}
            onPageDeleted={(id) => setPages((prev) => prev.filter((p) => p.id !== id))}
            onPageCreated={(page) => setPages((prev) => [page, ...prev])}
          />
        </div>
      </div>
    </RoomProvider>
  );
}

// ─── Page Detail View ──────────────────────────────────────────────────────────

function PageDetailView({
  page,
  space,
  currentUserId,
  onBack,
  onBackToSpaces,
  onPageUpdated,
  onPageDuplicated,
  onPageDeleted,
}: {
  page: PageRecord;
  space: SpaceRecord;
  currentUserId: number | null;
  onBack: () => void;
  onBackToSpaces: () => void;
  onPageUpdated: (page: PageRecord) => void;
  onPageDuplicated: (page: PageRecord) => void;
  onPageDeleted: () => void;
}) {
  return (
    <RoomProvider
      id={`page-${page.id}`}
      initialPresence={{ cursor: null, pageId: page.id, spaceId: space.id }}
      initialStorage={pageInitialStorage}
    >
      <ClientSideSuspense
        fallback={
          <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
            Loading collaboration…
          </div>
        }
      >
        <PageDetailInner
          page={page}
          space={space}
          currentUserId={currentUserId}
          onBack={onBack}
          onBackToSpaces={onBackToSpaces}
          onPageUpdated={onPageUpdated}
          onPageDuplicated={onPageDuplicated}
          onPageDeleted={onPageDeleted}
        />
      </ClientSideSuspense>
    </RoomProvider>
  );
}

function PageDetailInner({
  page,
  space,
  currentUserId,
  onBack,
  onBackToSpaces,
  onPageUpdated,
  onPageDuplicated,
  onPageDeleted,
}: {
  page: PageRecord;
  space: SpaceRecord;
  currentUserId: number | null;
  onBack: () => void;
  onBackToSpaces: () => void;
  onPageUpdated: (page: PageRecord) => void;
  onPageDuplicated: (page: PageRecord) => void;
  onPageDeleted: () => void;
}) {
  const updateMyPresence = useUpdateMyPresence();
  const col = getColorConfig(space.color);

  React.useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      updateMyPresence({ cursor: { x: e.clientX, y: e.clientY } });
    }
    function handleMouseLeave() {
      updateMyPresence({ cursor: null });
    }
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [updateMyPresence]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <LiveCursors />

      <div className="border-b border-border bg-white/80 px-5 py-4 backdrop-blur lg:px-7">
        <nav className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={onBackToSpaces}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium transition hover:bg-indigo-50 hover:text-indigo-600"
          >
            <ArrowLeft className="h-3 w-3" />
            All Spaces
          </button>
          <ChevronRight className="h-3 w-3" />
          <button
            type="button"
            onClick={onBack}
            className="rounded-md px-1.5 py-0.5 font-medium transition hover:bg-indigo-50 hover:text-indigo-600"
          >
            {space.name}
          </button>
          <ChevronRight className="h-3 w-3" />
          <span className="font-semibold text-foreground">{page.title}</span>
        </nav>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("grid h-10 w-10 place-items-center rounded-xl", col.light)}>
              <FileText className={cn("h-5 w-5", col.icon)} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-foreground">{page.title}</h1>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", getTemplateBadge(page.template))}>
                  {page.template}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                In <span className="font-medium text-foreground">{space.name}</span>
                {page.updatedByName && ` · Last edited by ${page.updatedByName}`}
                {` · ${formatRelative(page.updatedAt)}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <PresenceAvatars max={5} />
            <button
              type="button"
              onClick={async () => {
                const res = await fetch(`/api/pages/${page.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isFavorite: !page.isFavorite }) });
                if (res.ok) onPageUpdated(await res.json());
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-amber-50"
            >
              <Star className={cn("h-4 w-4", page.isFavorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 lg:px-7">
        <PageDetailPanel
          page={page}
          space={space}
          currentUserId={currentUserId}
          onPageUpdated={onPageUpdated}
          onPageDuplicated={onPageDuplicated}
          onPageDeleted={onPageDeleted}
          onNavigateToPage={onPageUpdated}
        />
      </div>
    </div>
  );
}

// ─── Root Component ────────────────────────────────────────────────────────────

export function PagesSpacesPage() {
  const { user } = useUser();
  const [view, setView] = React.useState<ViewMode>("all-spaces");
  const [activeSpace, setActiveSpace] = React.useState<SpaceRecord | null>(null);
  const [activePage, setActivePage] = React.useState<PageRecord | null>(null);
  const [spaces, setSpaces] = React.useState<SpaceRecord[]>([]);
  const [loadingSpaces, setLoadingSpaces] = React.useState(true);
  const [currentUserId, setCurrentUserId] = React.useState<number | null>(null);

  // Load spaces with page counts
  async function loadSpaces() {
    setLoadingSpaces(true);
    try {
      const res = await fetch("/api/spaces");
      if (res.ok) {
        const data = (await res.json()) as SpaceRecord[];
        // Fetch page counts in parallel
        const withCounts = await Promise.all(
          data.map(async (space) => {
            try {
              const pRes = await fetch(`/api/pages?spaceId=${space.id}`);
              const pages = pRes.ok ? (await pRes.json() as PageRecord[]) : [];
              return { ...space, pageCount: pages.filter((p) => !p.isArchived).length };
            } catch {
              return { ...space, pageCount: 0 };
            }
          })
        );
        setSpaces(withCounts);
      }
    } finally {
      setLoadingSpaces(false);
    }
  }

  React.useEffect(() => { void loadSpaces(); }, []);

  React.useEffect(() => {
    void (async () => {
      const res = await fetch("/api/me");
      if (res.ok) {
        const data = await res.json();
        setCurrentUserId(data.id ?? null);
      }
    })();
  }, [user?.id]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const spaceId = params.get("space");
    const pageId = params.get("page");
    if (!spaceId || spaces.length === 0) return;
    const space = spaces.find((s) => s.id === parseInt(spaceId, 10));
    if (!space) return;
    setActiveSpace(space);
    if (pageId) {
      void (async () => {
        const res = await fetch(`/api/pages/${pageId}`);
        if (res.ok) {
          const page = await res.json() as PageRecord;
          setActivePage(page);
          setView("page-detail");
        } else {
          setView("space-detail");
        }
      })();
    } else {
      setView("space-detail");
    }
  }, [spaces]);

  function handleSpaceClick(space: SpaceRecord) {
    setActiveSpace(space);
    setView("space-detail");
  }

  function handlePageClick(page: PageRecord) {
    setActivePage(page);
    setView("page-detail");
  }

  function handleBackToSpaces() {
    setActiveSpace(null);
    setActivePage(null);
    setView("all-spaces");
    void loadSpaces(); // refresh page counts
  }

  function handleBackToSpace() {
    setActivePage(null);
    setView("space-detail");
  }

  function handleSpaceUpdated(updated: SpaceRecord) {
    setSpaces((prev) => prev.map((s) => (s.id === updated.id ? { ...updated, pageCount: s.pageCount } : s)));
    if (activeSpace?.id === updated.id) setActiveSpace((prev) => prev ? { ...prev, ...updated } : prev);
  }

  function handleSpaceDeleted(id: number) {
    setSpaces((prev) => prev.filter((s) => s.id !== id));
    if (activeSpace?.id === id) handleBackToSpaces();
  }

  function handleSpaceCreated(space: SpaceRecord) {
    setSpaces((prev) => [{ ...space, pageCount: 0 }, ...prev]);
  }

  return (
    <LiveblocksProvider
      authEndpoint="/api/liveblocks-auth"
      resolveUsers={async ({ userIds }) => {
        try {
          const searchParams = new URLSearchParams();
          userIds.forEach((id) => searchParams.append("userIds", id));
          const response = await fetch(`/api/liveblocks-users?${searchParams}`);
          if (!response.ok) return userIds.map(() => null);
          return response.json();
        } catch {
          return userIds.map(() => null);
        }
      }}
    >
      <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-background">
        {view === "all-spaces" && (
          <AllSpacesView
            spaces={spaces}
            loading={loadingSpaces}
            currentUserId={currentUserId}
            onSpaceClick={handleSpaceClick}
            onSpaceUpdated={handleSpaceUpdated}
            onSpaceDeleted={handleSpaceDeleted}
            onSpaceCreated={handleSpaceCreated}
            onRefresh={loadSpaces}
          />
        )}
        {view === "space-detail" && activeSpace && (
          <SpaceDetailView
            space={activeSpace}
            allSpaces={spaces}
            currentUserId={currentUserId}
            onBack={handleBackToSpaces}
            onSpaceUpdated={handleSpaceUpdated}
            onNavigateToPage={handlePageClick}
          />
        )}
        {view === "page-detail" && activePage && activeSpace && (
          <PageDetailView
            page={activePage}
            space={activeSpace}
            currentUserId={currentUserId}
            onBack={handleBackToSpace}
            onBackToSpaces={handleBackToSpaces}
            onPageUpdated={(updated) => setActivePage(updated)}
            onPageDuplicated={(copy) => {
              setActivePage(copy);
              toast.success("Opened duplicated page");
            }}
            onPageDeleted={handleBackToSpace}
          />
        )}
      </div>
    </LiveblocksProvider>
  );
}
