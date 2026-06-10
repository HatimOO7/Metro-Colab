"use client";

import * as React from "react";
import { LiveObject } from "@liveblocks/client";
import { useMutation, useStorage, useBroadcastEvent, useEventListener } from "@liveblocks/react/suspense";
import {
  Check,
  Download,
  FileUp,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { PageTaskData } from "@/lib/page-room-storage";

type PageFileRecord = {
  id: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploaderName: string;
};

function randomTaskId() {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PageTaskCount() {
  const count = useStorage((root) => root.tasks?.length ?? 0);
  return <p className="mt-1 text-sm font-semibold">{count}</p>;
}

export function PageTasksSection({ pageId }: { pageId: number }) {
  const tasks = useStorage((root) => {
    const list = root.tasks;
    if (!list) return [] as PageTaskData[];
    return list.map((task) => ({
      id: task.id,
      title: task.title,
      completed: task.completed,
      createdAt: task.createdAt,
    }));
  });

  const [newTaskTitle, setNewTaskTitle] = React.useState("");
  const [files, setFiles] = React.useState<PageFileRecord[]>([]);
  const [loadingFiles, setLoadingFiles] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const broadcast = useBroadcastEvent();

  const addTask = useMutation(({ storage }, title: string) => {
    const list = storage.get("tasks");
    if (!list) return;
    list.push(
      new LiveObject<PageTaskData>({
        id: randomTaskId(),
        title,
        completed: false,
        createdAt: new Date().toISOString(),
      })
    );
  }, []);

  const toggleTask = useMutation(({ storage }, taskId: string) => {
    const list = storage.get("tasks");
    if (!list) return;
    for (const task of list) {
      if (task.get("id") === taskId) {
        task.set("completed", !task.get("completed"));
        break;
      }
    }
  }, []);

  const updateTaskTitle = useMutation(({ storage }, taskId: string, title: string) => {
    const list = storage.get("tasks");
    if (!list) return;
    for (const task of list) {
      if (task.get("id") === taskId) {
        task.set("title", title);
        break;
      }
    }
  }, []);

  const removeTask = useMutation(({ storage }, taskId: string) => {
    const list = storage.get("tasks");
    if (!list) return;
    const index = list.findIndex((task) => task.get("id") === taskId);
    if (index >= 0) list.delete(index);
  }, []);

  const loadFiles = React.useCallback(async () => {
    const res = await fetch(`/api/pages/${pageId}/files`);
    if (res.ok) {
      const data = await res.json();
      setFiles(data.files ?? []);
    }
    setLoadingFiles(false);
  }, [pageId]);

  React.useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  useEventListener(({ event }) => {
    if (event.type === "FILES_CHANGED") {
      void loadFiles();
    }
  });

  function handleAddTask(e?: React.FormEvent) {
    e?.preventDefault();
    const title = newTaskTitle.trim();
    if (!title) return;
    addTask(title);
    setNewTaskTitle("");
  }

  async function handleFileUpload(fileList: FileList | null) {
    if (!fileList?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(`/api/pages/${pageId}/files`, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error((err as { error?: string }).error ?? `Failed to upload ${file.name}`);
          continue;
        }
        toast.success(`${file.name} uploaded`);
      }
      await loadFiles();
      broadcast({ type: "FILES_CHANGED" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteFile(fileId: number) {
    const res = await fetch(`/api/pages/${pageId}/files/${fileId}`, { method: "DELETE" });
    if (res.ok) {
      await loadFiles();
      broadcast({ type: "FILES_CHANGED" });
      toast.success("File removed");
    } else {
      toast.error("Failed to remove file");
    }
  }

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div>
        <p className="text-xs font-semibold text-foreground">Tasks</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Add unlimited custom tasks — synced live for everyone on this page.
        </p>
      </div>

      <form onSubmit={handleAddTask} className="flex gap-2">
        <input
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder="Add a new task…"
          className="h-9 flex-1 rounded-lg border border-border px-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
        <button
          type="submit"
          disabled={!newTaskTitle.trim()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </form>

      <div className="space-y-1">
        {tasks.map((task) => (
          <PageTaskRow
            key={task.id}
            task={task}
            onToggle={() => toggleTask(task.id)}
            onRemove={() => removeTask(task.id)}
            onTitleChange={(title) => updateTaskTitle(task.id, title)}
          />
        ))}
        {tasks.length === 0 && (
          <p className="text-xs text-muted-foreground">No tasks yet. Add one above.</p>
        )}
      </div>

      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4">
        <div className="flex items-center gap-2">
          <FileUp className="h-4 w-4 text-indigo-500" />
          <p className="text-xs font-semibold text-foreground">Shared files</p>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Upload files for all members collaborating on this page.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => void handleFileUpload(e.target.files)}
        />

        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {uploading ? "Uploading…" : "Choose files"}
        </button>

        <div className="mt-3 space-y-1">
          {loadingFiles ? (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading files…
            </p>
          ) : files.length === 0 ? (
            <p className="text-xs text-muted-foreground">No files shared yet.</p>
          ) : (
            files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-white px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.fileName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatFileSize(file.sizeBytes)} · {file.uploaderName}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <a
                    href={`/api/pages/${pageId}/files/${file.id}`}
                    download={file.fileName}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-indigo-600 hover:bg-indigo-50"
                    title="Download"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => void handleDeleteFile(file.id)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-destructive hover:bg-red-50"
                    title="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function PageTaskRow({
  task,
  onToggle,
  onRemove,
  onTitleChange,
}: {
  task: PageTaskData;
  onToggle: () => void;
  onRemove: () => void;
  onTitleChange: (title: string) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(task.title);

  React.useEffect(() => {
    if (!editing) setDraft(task.title);
  }, [task.title, editing]);

  function commitTitle() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== task.title) {
      onTitleChange(trimmed);
    } else {
      setDraft(task.title);
    }
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition",
          task.completed
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-border bg-white text-transparent hover:border-emerald-300"
        )}
        aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
      >
        <Check className="h-3 w-3" />
      </button>

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitTitle();
            if (e.key === "Escape") {
              setDraft(task.title);
              setEditing(false);
            }
          }}
          className="min-w-0 flex-1 rounded border border-indigo-200 px-2 py-0.5 text-sm outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={cn(
            "min-w-0 flex-1 truncate text-left text-sm",
            task.completed && "text-muted-foreground line-through"
          )}
        >
          {task.title}
        </button>
      )}

      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 text-muted-foreground hover:text-destructive"
        aria-label="Remove task"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
