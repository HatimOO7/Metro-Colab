"use client";

import * as React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Strikethrough as StrikethroughIcon,
  Code as CodeIcon,
  Heading1 as H1Icon,
  Heading2 as H2Icon,
  List as BulletListIcon,
  ListOrdered as OrderedListIcon,
  Quote as QuoteIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Search,
  Plus,
  Trash2,
  Pin,
  Sparkles,
  Copy,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  RotateCcw,
  Palette,
  Smile,
  FileText,
  Loader2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import debounce from "lodash/debounce";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Keeps Tiptap focused when clicking toolbar triggers (not Radix menu items). */
const preventEditorBlur = {
  onPointerDown: (e: React.PointerEvent) => e.preventDefault(),
  onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
};

type AiSelectionSnapshot = {
  from: number;
  to: number;
  text: string;
  hasSelection: boolean;
};

// Types
type Note = {
  id: number;
  title: string;
  content: string;
  icon: string;
  color: string;
  isPinned: boolean;
  isTrash: boolean;
  createdAt: string;
  updatedAt: string;
};

const NOTE_COLORS = [
  { name: "amber", border: "border-l-amber-500", bg: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
  { name: "coral", border: "border-l-coral-600", bg: "bg-coral-100 text-coral-700", dot: "bg-coral-600" },
  { name: "sky", border: "border-l-sky-500", bg: "bg-sky-100 text-sky-800", dot: "bg-sky-500" },
  { name: "emerald", border: "border-l-emerald-500", bg: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500" },
  { name: "violet", border: "border-l-violet-500", bg: "bg-violet-100 text-violet-800", dot: "bg-violet-500" },
  { name: "slate", border: "border-l-slate-400", bg: "bg-slate-100 text-slate-800", dot: "bg-slate-400" },
];

const NOTE_ICONS = ["📄", "📝", "💡", "🧠", "🎯", "🚀", "💻", "✨", "🎨", "📅", "📚", "🔑", "❤️"];

export function NotesPage() {
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = React.useState<number | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [savingState, setSavingState] = React.useState<"saved" | "saving" | "error">("saved");
  const [menuNoteId, setMenuNoteId] = React.useState<number | null>(null);
  const [renamingNoteId, setRenamingNoteId] = React.useState<number | null>(null);
  const [renamingTitle, setRenamingTitle] = React.useState("");
  const [isTrashExpanded, setIsTrashExpanded] = React.useState(false);
  const [isAiRefining, setIsAiRefining] = React.useState(false);

  // Slash commands popup state
  const [slashMenuOpen, setSlashMenuOpen] = React.useState(false);
  const [slashMenuPos, setSlashMenuPos] = React.useState({ top: 0, left: 0 });
  const [slashSelectedIndex, setSlashSelectedIndex] = React.useState(0);

  const activeNote = React.useMemo(() => notes.find((n) => n.id === activeNoteId) || null, [notes, activeNoteId]);

  const lastSavedContent = React.useRef("");
  const isSettingContent = React.useRef(false);
  const activeNoteIdRef = React.useRef<number | null>(null);

  // Ref references
  const menuRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const previousNoteIdRef = React.useRef<number | null>(null);
  const aiSelectionRef = React.useRef<AiSelectionSnapshot | null>(null);
  const isAiRefiningRef = React.useRef(false);

  React.useEffect(() => {
    activeNoteIdRef.current = activeNoteId;
  }, [activeNoteId]);

  // Fetch all notes on load
  const fetchNotes = React.useCallback(async (selectFirst = false) => {
    try {
      const res = await fetch("/api/notes");
      if (!res.ok) throw new Error("Failed to load notes");
      const data = await res.json();
      setNotes(data.notes || []);

      if (data.notes && data.notes.length > 0) {
        if (selectFirst) {
          // Find first non-trash note
          const activeNotes = data.notes.filter((n: Note) => !n.isTrash);
          if (activeNotes.length > 0) {
            setActiveNoteId(activeNotes[0].id);
          } else {
            setActiveNoteId(data.notes[0].id);
          }
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("Could not load notes from database.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchNotes(true);
  }, [fetchNotes]);

  // Click outside listener for the dropdown menu
  React.useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuNoteId(null);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Save note content to database
  const saveNoteContent = React.useCallback(async (noteId: number, content: string, title?: string) => {
    setSavingState("saving");
    try {
      const payload: Partial<Note> = { content };
      if (title !== undefined) payload.title = title;

      const res = await fetch(`/api/notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save");

      const data = await res.json();
      
      // Update local state list with updated timestamp
      setNotes((prevNotes) =>
        prevNotes.map((n) => (n.id === noteId ? { ...n, ...data.note } : n))
      );
      setSavingState("saved");
      lastSavedContent.current = content;
    } catch (err) {
      console.error("Save error:", err);
      setSavingState("error");
      toast.error("Auto-save failed. Check your connection.");
    }
  }, []);

  const debouncedSaveNoteContent = React.useMemo(
    () =>
      debounce((noteId: number, content: string, title?: string) => {
        if (title === undefined && content === lastSavedContent.current) return;
        void saveNoteContent(noteId, content, title);
      }, 1500),
    [saveNoteContent]
  );

  const debouncedSaveNoteContentRef = React.useRef(debouncedSaveNoteContent);
  React.useEffect(() => {
    debouncedSaveNoteContentRef.current = debouncedSaveNoteContent;
  }, [debouncedSaveNoteContent]);

  React.useEffect(() => {
    return () => {
      debouncedSaveNoteContent.cancel();
    };
  }, [debouncedSaveNoteContent]);

  // Editor initialization
  const editor = useEditor({
    extensions: [
      StarterKit,
      CharacterCount,
      Placeholder.configure({
        placeholder: "Press '/' for commands...",
      }),
    ],
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "outline-none whitespace-pre-wrap min-h-[400px] pb-32",
      },
      handleKeyDown(view, event) {
        // Handle custom navigation in Slash commands dropdown
        if (slashMenuOpen) {
          if (event.key === "ArrowDown") {
            setSlashSelectedIndex((prev) => (prev + 1) % slashItems.length);
            event.preventDefault();
            return true;
          }
          if (event.key === "ArrowUp") {
            setSlashSelectedIndex((prev) => (prev - 1 + slashItems.length) % slashItems.length);
            event.preventDefault();
            return true;
          }
          if (event.key === "Enter") {
            handleSelectSlashItem(slashItems[slashSelectedIndex].id);
            event.preventDefault();
            return true;
          }
          if (event.key === "Escape") {
            setSlashMenuOpen(false);
            event.preventDefault();
            return true;
          }
        }
        return false;
      },
    },
    onUpdate({ editor }) {
      if (isSettingContent.current) return;

      // Text length check for slash command trigger
      const { selection } = editor.state;
      const { $from } = selection;
      const textBefore = $from.nodeBefore?.isText ? $from.nodeBefore.text : "";
      
      if (textBefore && textBefore.endsWith("/")) {
        // Find cursor coordinates
        const view = editor.view;
        const coords = view.coordsAtPos($from.pos);
        const editorEl = view.dom;
        const rect = editorEl.getBoundingClientRect();
        
        setSlashMenuPos({
          top: coords.bottom - rect.top + editorEl.scrollTop + 8,
          left: coords.left - rect.left,
        });
        setSlashMenuOpen(true);
        setSlashSelectedIndex(0);
      } else {
        setSlashMenuOpen(false);
      }

      const noteId = activeNoteIdRef.current;
      if (!noteId) return;

      debouncedSaveNoteContentRef.current(noteId, editor.getHTML());
    },
  });

  // Load active note content into editor
  React.useEffect(() => {
    if (!editor || !activeNote) return;

    // Immediately save previous unsaved content if any
    const previousNoteId = previousNoteIdRef.current;
    if (previousNoteId && previousNoteId !== activeNote.id) {
      debouncedSaveNoteContent.flush();
      const html = editor.getHTML();
      if (html !== lastSavedContent.current) {
        void saveNoteContent(previousNoteId, html);
      }
    }

    debouncedSaveNoteContent.cancel();

    isSettingContent.current = true;
    editor.commands.setContent(activeNote.content);
    lastSavedContent.current = activeNote.content;
    isSettingContent.current = false;
    setSlashMenuOpen(false);
    setSavingState("saved");

    // Update the previous note ID ref
    previousNoteIdRef.current = activeNote.id;
  }, [activeNoteId, editor]); // We selectively trigger only on activeNoteId change to prevent cursor resets on content save

  // Slash commands data
  const slashItems = [
    { id: "h1", label: "Heading 1", description: "Big section title", icon: H1Icon },
    { id: "h2", label: "Heading 2", description: "Medium section title", icon: H2Icon },
    { id: "bullet", label: "Bulleted list", description: "Simple bullet points", icon: BulletListIcon },
    { id: "ordered", label: "Numbered list", description: "Sequential list items", icon: OrderedListIcon },
    { id: "quote", label: "Blockquote", description: "Capture a quote", icon: QuoteIcon },
    { id: "code", label: "Code block", description: "Write raw code snippet", icon: CodeIcon },
    { id: "divider", label: "Divider", description: "A horizontal dividing line", icon: StrikethroughIcon },
  ];

  const handleSelectSlashItem = (itemId: string) => {
    if (!editor) return;

    const { selection } = editor.state;
    const { $from } = selection;

    // Delete the "/" character
    editor.chain().focus().deleteRange({ from: $from.pos - 1, to: $from.pos }).run();

    switch (itemId) {
      case "h1":
        editor.chain().focus().toggleHeading({ level: 1 }).run();
        break;
      case "h2":
        editor.chain().focus().toggleHeading({ level: 2 }).run();
        break;
      case "bullet":
        editor.chain().focus().toggleBulletList().run();
        break;
      case "ordered":
        editor.chain().focus().toggleOrderedList().run();
        break;
      case "quote":
        editor.chain().focus().toggleBlockquote().run();
        break;
      case "code":
        editor.chain().focus().toggleCodeBlock().run();
        break;
      case "divider":
        editor.chain().focus().setHorizontalRule().run();
        break;
    }
    setSlashMenuOpen(false);
  };

  // Note actions
  const createNewNote = async () => {
    try {
      const res = await fetch("/api/notes", { method: "POST" });
      if (!res.ok) throw new Error("Could not create note");
      const data = await res.json();
      
      setNotes((prevNotes) => [data.note, ...prevNotes]);
      setActiveNoteId(data.note.id);
      toast.success("Created new note");
    } catch (error) {
      console.error(error);
      toast.error("Failed to create note.");
    }
  };

  const updateNoteMetadata = async (noteId: number, payload: Partial<Note>) => {
    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update");
      const data = await res.json();
      setNotes((prevNotes) =>
        prevNotes.map((n) => (n.id === noteId ? { ...n, ...data.note } : n))
      );
      return data.note;
    } catch (error) {
      console.error(error);
      toast.error("Failed to update note details.");
    }
  };

  const deleteNotePermanently = async (noteId: number) => {
    try {
      const res = await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      
      setNotes((prevNotes) => prevNotes.filter((n) => n.id !== noteId));
      if (activeNoteId === noteId) {
        const remaining = notes.filter((n) => n.id !== noteId && !n.isTrash);
        setActiveNoteId(remaining.length > 0 ? remaining[0].id : null);
      }
      toast.success("Note permanently deleted.");
    } catch (error) {
      console.error(error);
      toast.error("Could not delete note permanently.");
    }
  };

  const duplicateNote = async (noteId: number) => {
    try {
      const res = await fetch(`/api/notes/${noteId}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to duplicate");
      const data = await res.json();

      setNotes((prevNotes) => [data.note, ...prevNotes]);
      setActiveNoteId(data.note.id);
      toast.success("Note duplicated!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to duplicate note.");
    }
  };

  const handleRenameSubmit = async (noteId: number) => {
    if (!renamingTitle.trim()) {
      setRenamingNoteId(null);
      return;
    }
    await updateNoteMetadata(noteId, { title: renamingTitle.trim() });
    setRenamingNoteId(null);
  };

  const captureAiSelection = React.useCallback(() => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const hasSelection = from !== to;
    const text = hasSelection
      ? editor.state.doc.textBetween(from, to, " ")
      : editor.getText();

    aiSelectionRef.current = { from, to, text, hasSelection };
  }, [editor]);

  // AI Refine — uses snapshot captured when the dropdown opens (selection is lost on item click).
  const runAiRefine = React.useCallback(async (action: string, tone?: string) => {
    if (!editor || isAiRefiningRef.current) return;

    const snapshot = aiSelectionRef.current;
    if (!snapshot) {
      toast.error("Nothing to refine.");
      return;
    }

    const { from, to, text: textToRefine, hasSelection } = snapshot;

    if (!textToRefine.trim()) {
      toast.error("Nothing to refine.");
      return;
    }

    isAiRefiningRef.current = true;
    setIsAiRefining(true);
    const refineToast = toast.loading(
      hasSelection ? "AI is refining your selection..." : "AI is refining your note..."
    );

    try {
      const res = await fetch("/api/ai/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToRefine, action, tone }),
      });

      let data: { error?: string; refinedText?: string } = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok) {
        const message =
          typeof data.error === "string"
            ? data.error
            : res.status === 503
              ? "The AI service is temporarily unavailable. Please try again in a moment."
              : "AI refinement failed. Try again.";
        toast.dismiss(refineToast);
        toast.error(message);
        return;
      }

      const refinedText = typeof data.refinedText === "string" ? data.refinedText.trim() : "";
      if (!refinedText) {
        toast.dismiss(refineToast);
        toast.error("AI returned an empty response. Try again.");
        return;
      }

      if (hasSelection) {
        const docSize = editor.state.doc.content.size;
        const safeFrom = Math.max(0, Math.min(from, docSize));
        const safeTo = Math.max(safeFrom, Math.min(to, docSize));

        editor
          .chain()
          .focus()
          .setTextSelection({ from: safeFrom, to: safeTo })
          .insertContent(refinedText)
          .run();
      } else {
        editor.chain().focus().setContent(refinedText).run();
      }

      toast.dismiss(refineToast);
      toast.success("Text refined by AI!");
    } catch (error) {
      console.error("AI refinement error:", error);
      toast.dismiss(refineToast);
      toast.error("AI refinement failed. Check your connection and try again.");
    } finally {
      isAiRefiningRef.current = false;
      setIsAiRefining(false);
      aiSelectionRef.current = null;
    }
  }, [editor]);

  // Helper counts
  const wordCount = editor ? editor.storage.characterCount.words() : 0;
  const charCount = editor ? editor.storage.characterCount.characters() : 0;

  // Filtered lists
  const filteredNotes = notes.filter(
    (n) =>
      (n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const pinnedNotesList = filteredNotes.filter((n) => n.isPinned && !n.isTrash);
  const activeNotesList = filteredNotes.filter((n) => !n.isPinned && !n.isTrash);
  const trashNotesList = filteredNotes.filter((n) => n.isTrash);

  return (
    <div className="flex h-[calc(100vh-100px)] overflow-hidden rounded-xl border border-border bg-card shadow-soft">
      {/* 1. Left Notes Panel */}
      <aside className="flex w-[300px] shrink-0 flex-col border-r border-border bg-sidebar/40">
        {/* Search & New Note Header */}
        <div className="flex flex-col gap-2 p-3 border-b border-border/80 bg-sidebar/20">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-border bg-white pl-8 pr-3 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring focus:border-ring transition"
              />
            </div>
            <Button
              size="icon"
              onClick={createNewNote}
              className="h-8 w-8 rounded-lg bg-foreground text-background hover:bg-foreground/90 shrink-0 shadow-sm"
              title="New Note"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Scrollable list */}
        <ScrollArea className="flex-1 px-2 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-12 text-xs text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/55 animate-pulse" />
              No notes yet. Create one!
            </div>
          ) : (
            <div className="space-y-4 pb-20">
              {/* Pinned section */}
              {pinnedNotesList.length > 0 && (
                <div className="space-y-1">
                  <p className="px-2 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground flex items-center gap-1">
                    <Pin className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                    Pinned
                  </p>
                  <div className="space-y-0.5">
                    {pinnedNotesList.map((note) => (
                      <NoteListItem
                        key={note.id}
                        note={note}
                        isActive={note.id === activeNoteId}
                        onSelect={() => setActiveNoteId(note.id)}
                        onOpenMenu={(e) => {
                          e.stopPropagation();
                          setMenuNoteId(note.id);
                        }}
                        renamingNoteId={renamingNoteId}
                        renamingTitle={renamingTitle}
                        setRenamingTitle={setRenamingTitle}
                        onRenameSubmit={handleRenameSubmit}
                        onRenameCancel={() => setRenamingNoteId(null)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Regular notes section */}
              <div className="space-y-1">
                {pinnedNotesList.length > 0 && (
                  <p className="px-2 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    All Notes
                  </p>
                )}
                {activeNotesList.length === 0 && pinnedNotesList.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-muted-foreground italic">No active notes matching search</p>
                ) : (
                  <div className="space-y-0.5">
                    {activeNotesList.map((note) => (
                      <NoteListItem
                        key={note.id}
                        note={note}
                        isActive={note.id === activeNoteId}
                        onSelect={() => setActiveNoteId(note.id)}
                        onOpenMenu={(e) => {
                          e.stopPropagation();
                          setMenuNoteId(note.id);
                        }}
                        renamingNoteId={renamingNoteId}
                        renamingTitle={renamingTitle}
                        setRenamingTitle={setRenamingTitle}
                        onRenameSubmit={handleRenameSubmit}
                        onRenameCancel={() => setRenamingNoteId(null)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Trash Collapsible Header */}
              {trashNotesList.length > 0 && (
                <div className="border-t border-border/60 pt-3 mt-4 space-y-1">
                  <button
                    onClick={() => setIsTrashExpanded(!isTrashExpanded)}
                    className="flex w-full items-center justify-between px-2 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground transition"
                  >
                    <span className="flex items-center gap-1">
                      <Trash2 className="h-2.5 w-2.5 text-red-500" />
                      Trash ({trashNotesList.length})
                    </span>
                    {isTrashExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>

                  {isTrashExpanded && (
                    <div className="space-y-0.5 pt-1">
                      {trashNotesList.map((note) => (
                        <NoteListItem
                          key={note.id}
                          note={note}
                          isActive={note.id === activeNoteId}
                          onSelect={() => setActiveNoteId(note.id)}
                          onOpenMenu={(e) => {
                            e.stopPropagation();
                            setMenuNoteId(note.id);
                          }}
                          renamingNoteId={renamingNoteId}
                          renamingTitle={renamingTitle}
                          setRenamingTitle={setRenamingTitle}
                          onRenameSubmit={handleRenameSubmit}
                          onRenameCancel={() => setRenamingNoteId(null)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </aside>

      {/* Floating Menu Popover (Custom Options Menu) */}
      {menuNoteId && (
        <OptionsMenu
          note={notes.find((n) => n.id === menuNoteId)!}
          onClose={() => setMenuNoteId(null)}
          onPinToggle={(note) => {
            updateNoteMetadata(note.id, { isPinned: !note.isPinned });
            setMenuNoteId(null);
          }}
          onDuplicate={(note) => {
            duplicateNote(note.id);
            setMenuNoteId(null);
          }}
          onRenameTrigger={(note) => {
            setRenamingNoteId(note.id);
            setRenamingTitle(note.title);
            setMenuNoteId(null);
          }}
          onColorChange={(note, color) => {
            updateNoteMetadata(note.id, { color });
          }}
          onIconChange={(note, icon) => {
            updateNoteMetadata(note.id, { icon });
          }}
          onTrashToggle={(note) => {
            updateNoteMetadata(note.id, { isTrash: !note.isTrash, isPinned: false });
            setMenuNoteId(null);
            toast.success(note.isTrash ? "Restored note from Trash" : "Note moved to Trash");
          }}
          onDeletePermanent={(note) => {
            if (confirm("Are you sure you want to permanently delete this note? This action is irreversible.")) {
              deleteNotePermanently(note.id);
            }
            setMenuNoteId(null);
          }}
          menuRef={menuRef}
        />
      )}

      {/* 2. Right Rich Text Editor Panel */}
      <section className="flex-1 flex flex-col min-w-0 bg-white">
        {activeNote ? (
          <>
            {/* Header / Top Editable Info */}
            <div className="flex flex-col shrink-0 border-b border-border/75 px-6 py-4 bg-white z-10">
              <div className="flex items-start justify-between gap-4">
                {/* Icon & Title Row */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button
                    onClick={() => setMenuNoteId(activeNote.id)}
                    className="h-10 w-10 shrink-0 text-2xl flex items-center justify-center bg-sidebar/30 rounded-lg hover:bg-sidebar/80 transition"
                    title="Change icon/color"
                  >
                    {activeNote.icon}
                  </button>
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={activeNote.title}
                      onChange={(e) => {
                        const newTitle = e.target.value;
                        setNotes((prevNotes) =>
                          prevNotes.map((n) => (n.id === activeNote.id ? { ...n, title: newTitle } : n))
                        );
                        debouncedSaveNoteContent(activeNote.id, editor?.getHTML() || "", newTitle);
                      }}
                      placeholder="Untitled Note"
                      className="w-full text-2xl font-bold text-foreground bg-transparent border-none outline-none placeholder:text-muted-foreground/45"
                    />
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={cn(
                          "inline-block w-2.5 h-2.5 rounded-full",
                          NOTE_COLORS.find((c) => c.name === activeNote.color)?.dot || "bg-amber-500"
                        )}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        Last edited {new Date(activeNote.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pin and Options buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                    onClick={() => updateNoteMetadata(activeNote.id, { isPinned: !activeNote.isPinned })}
                    title={activeNote.isPinned ? "Unpin Note" : "Pin Note"}
                  >
                    <Pin className={cn("h-4 w-4", activeNote.isPinned && "fill-amber-500 text-amber-500")} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuNoteId(activeNote.id);
                    }}
                    title="Note options"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Tiptap Sticky Formatting Toolbar */}
              <div className="flex flex-wrap items-center gap-0.5 border border-border/80 rounded-lg p-1 mt-4 bg-sidebar/10">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-7 w-7 rounded-md", editor?.isActive("heading", { level: 1 }) && "bg-sidebar-active shadow-sm")}
                  onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                  onMouseDown={(e) => e.preventDefault()}
                  title="Heading 1"
                >
                  <H1Icon className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-7 w-7 rounded-md", editor?.isActive("heading", { level: 2 }) && "bg-sidebar-active shadow-sm")}
                  onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                  onMouseDown={(e) => e.preventDefault()}
                  title="Heading 2"
                >
                  <H2Icon className="h-3.5 w-3.5" />
                </Button>
                <div className="w-px h-4 bg-border/80 mx-1" />
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-7 w-7 rounded-md", editor?.isActive("bold") && "bg-sidebar-active shadow-sm")}
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  onMouseDown={(e) => e.preventDefault()}
                  title="Bold (Ctrl+B)"
                >
                  <BoldIcon className="h-3.5 w-3.5 font-bold" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-7 w-7 rounded-md", editor?.isActive("italic") && "bg-sidebar-active shadow-sm")}
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  onMouseDown={(e) => e.preventDefault()}
                  title="Italic (Ctrl+I)"
                >
                  <ItalicIcon className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-7 w-7 rounded-md", editor?.isActive("underline") && "bg-sidebar-active shadow-sm")}
                  onClick={() => editor?.chain().focus().toggleUnderline().run()}
                  onMouseDown={(e) => e.preventDefault()}
                  title="Underline (Ctrl+U)"
                >
                  <UnderlineIcon className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-7 w-7 rounded-md", editor?.isActive("strike") && "bg-sidebar-active shadow-sm")}
                  onClick={() => editor?.chain().focus().toggleStrike().run()}
                  onMouseDown={(e) => e.preventDefault()}
                  title="Strikethrough"
                >
                  <StrikethroughIcon className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-7 w-7 rounded-md", editor?.isActive("code") && "bg-sidebar-active shadow-sm")}
                  onClick={() => editor?.chain().focus().toggleCode().run()}
                  onMouseDown={(e) => e.preventDefault()}
                  title="Inline Code"
                >
                  <CodeIcon className="h-3.5 w-3.5" />
                </Button>
                <div className="w-px h-4 bg-border/80 mx-1" />
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-7 w-7 rounded-md", editor?.isActive("bulletList") && "bg-sidebar-active shadow-sm")}
                  onClick={() => editor?.chain().focus().toggleBulletList().run()}
                  onMouseDown={(e) => e.preventDefault()}
                  title="Bulleted List"
                >
                  <BulletListIcon className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-7 w-7 rounded-md", editor?.isActive("orderedList") && "bg-sidebar-active shadow-sm")}
                  onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                  onMouseDown={(e) => e.preventDefault()}
                  title="Numbered List"
                >
                  <OrderedListIcon className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-7 w-7 rounded-md", editor?.isActive("blockquote") && "bg-sidebar-active shadow-sm")}
                  onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                  onMouseDown={(e) => e.preventDefault()}
                  title="Quote Block"
                >
                  <QuoteIcon className="h-3.5 w-3.5" />
                </Button>
                <div className="w-px h-4 bg-border/80 mx-1" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-md"
                  onClick={() => editor?.chain().focus().undo().run()}
                  onMouseDown={(e) => e.preventDefault()}
                  disabled={!editor?.can().undo()}
                  title="Undo (Ctrl+Z)"
                >
                  <UndoIcon className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-md"
                  onClick={() => editor?.chain().focus().redo().run()}
                  onMouseDown={(e) => e.preventDefault()}
                  disabled={!editor?.can().redo()}
                  title="Redo (Ctrl+Y)"
                >
                  <RedoIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Writing Area */}
            <div className="flex-1 overflow-y-auto px-10 py-6 relative">
              {/* Tiptap HTML Canvas */}
              {editor && (
                <>
                  <div
                    className={cn(
                      "prose prose-sm sm:prose lg:prose-lg max-w-none dark:prose-invert focus:outline-none relative",
                      isAiRefining && "pointer-events-none opacity-60"
                    )}
                  >
                    {isAiRefining && (
                      <div className="absolute inset-0 z-10 flex items-start justify-center pt-8">
                        <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-white/90 px-3 py-2 text-xs font-medium text-violet-700 shadow-sm">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Refining with AI...
                        </div>
                      </div>
                    )}
                    <EditorContent editor={editor} />
                  </div>

                  {/* Tiptap Bubble Menu */}
                  <BubbleMenu
                    editor={editor}
                    className="flex items-center gap-0.5 border border-border bg-white shadow-soft rounded-lg p-1 z-50"
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn("h-7 w-7 rounded-md", editor.isActive("bold") && "bg-sidebar")}
                      onClick={() => editor.chain().focus().toggleBold().run()}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <BoldIcon className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn("h-7 w-7 rounded-md", editor.isActive("italic") && "bg-sidebar")}
                      onClick={() => editor.chain().focus().toggleItalic().run()}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <ItalicIcon className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn("h-7 w-7 rounded-md", editor.isActive("underline") && "bg-sidebar")}
                      onClick={() => editor.chain().focus().toggleUnderline().run()}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <UnderlineIcon className="h-3.5 w-3.5" />
                    </Button>
                    <div className="w-px h-4 bg-border/80 mx-1" />
                    {/* AI Refine Dropdown inside Bubble Menu */}
                    <DropdownMenu
                      modal={false}
                      onOpenChange={(open) => {
                        if (open) captureAiSelection();
                      }}
                    >
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isAiRefining}
                          className={cn(
                            "h-7 px-2 rounded-md text-xs font-medium text-violet-700 hover:text-violet-800 hover:bg-violet-50 flex items-center gap-1",
                            isAiRefining && "opacity-70"
                          )}
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          {isAiRefining ? (
                            <Loader2 className="h-3 w-3 text-violet-600 animate-spin" />
                          ) : (
                            <Sparkles className="h-3 w-3 text-violet-600 animate-pulse" />
                          )}
                          {isAiRefining ? "Refining..." : "AI Refine"}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        side="top"
                        className="w-44"
                        onCloseAutoFocus={(e) => e.preventDefault()}
                      >
                        <DropdownMenuItem
                          onSelect={() => void runAiRefine("grammar")}
                          disabled={isAiRefining}
                          className="text-[11px]"
                        >
                          {isAiRefining ? (
                            <Loader2 className="h-3 w-3 animate-spin text-violet-600" />
                          ) : null}
                          Improve grammar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => void runAiRefine("rephrase")}
                          disabled={isAiRefining}
                          className="text-[11px]"
                        >
                          Rephrase
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => void runAiRefine("shorter")}
                          disabled={isAiRefining}
                          className="text-[11px]"
                        >
                          Make shorter
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => void runAiRefine("longer")}
                          disabled={isAiRefining}
                          className="text-[11px]"
                        >
                          Make longer
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => void runAiRefine("simplify")}
                          disabled={isAiRefining}
                          className="text-[11px]"
                        >
                          Simplify language
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
                          Change Tone
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                          onSelect={() => void runAiRefine("tone", "professional")}
                          disabled={isAiRefining}
                          className="text-[11px]"
                        >
                          💼 Professional
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => void runAiRefine("tone", "casual")}
                          disabled={isAiRefining}
                          className="text-[11px]"
                        >
                          ☕ Casual
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => void runAiRefine("tone", "creative")}
                          disabled={isAiRefining}
                          className="text-[11px]"
                        >
                          🎨 Creative
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </BubbleMenu>

                  {/* Notion-Style Floating Slash Suggestion Popup */}
                  {slashMenuOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: slashMenuPos.top,
                        left: Math.max(16, Math.min(slashMenuPos.left, 550)),
                      }}
                      className="w-56 bg-white border border-border shadow-lg rounded-lg p-1 z-40 max-h-[300px] overflow-y-auto flex flex-col font-sans"
                    >
                      <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50 mb-1">
                        Basic Blocks
                      </div>
                      {slashItems.map((item, index) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleSelectSlashItem(item.id)}
                            className={cn(
                              "w-full text-left px-2 py-1.5 rounded-md flex items-center gap-2.5 transition text-xs",
                              index === slashSelectedIndex ? "bg-sidebar text-foreground font-medium" : "hover:bg-sidebar/55 text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <span className="h-6 w-6 rounded bg-card flex items-center justify-center shrink-0 border border-border/60">
                              <Icon className="h-3.5 w-3.5 text-foreground" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-foreground truncate">{item.label}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{item.description}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Bottom metadata / Info bar */}
            <div className="shrink-0 border-t border-border/75 px-6 py-2 bg-sidebar/5 flex items-center justify-between text-[10px] text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>{wordCount} words</span>
                <span>•</span>
                <span>{charCount} characters</span>
              </div>
              <div className="flex items-center gap-1 font-semibold">
                {savingState === "saving" && (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
                    <span>Saving...</span>
                  </>
                )}
                {savingState === "saved" && (
                  <>
                    <Check className="h-3 w-3 text-emerald-500" />
                    <span className="text-emerald-600">Saved</span>
                  </>
                )}
                {savingState === "error" && (
                  <span className="text-red-500">Unsaved Changes</span>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-sidebar/5">
            <FileText className="h-12 w-12 text-muted-foreground/35 mb-4 animate-bounce" />
            <h3 className="text-lg font-semibold">No Note Selected</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              Select an existing note from the sidebar panel or create a new note page to start writing.
            </p>
            <Button
              onClick={createNewNote}
              className="mt-4 bg-foreground text-background hover:bg-foreground/90 font-medium"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create new note
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

// Subcomponents for cleaner organization

// 1. Note List Item
type NoteListItemProps = {
  note: Note;
  isActive: boolean;
  onSelect: () => void;
  onOpenMenu: (e: React.MouseEvent) => void;
  renamingNoteId: number | null;
  renamingTitle: string;
  setRenamingTitle: (t: string) => void;
  onRenameSubmit: (noteId: number) => void;
  onRenameCancel: () => void;
};

function NoteListItem({
  note,
  isActive,
  onSelect,
  onOpenMenu,
  renamingNoteId,
  renamingTitle,
  setRenamingTitle,
  onRenameSubmit,
  onRenameCancel,
}: NoteListItemProps) {
  const isRenaming = renamingNoteId === note.id;
  const colorMatch = NOTE_COLORS.find((c) => c.name === note.color) || NOTE_COLORS[0];

  return (
    <div
      onClick={isRenaming ? undefined : onSelect}
      className={cn(
        "group relative flex items-center justify-between gap-2 p-2 rounded-lg cursor-pointer transition border-l-3",
        colorMatch.border,
        isActive
          ? "bg-white text-foreground shadow-soft ring-1 ring-black/5"
          : "hover:bg-white/70 text-muted-foreground hover:text-foreground",
        note.isTrash && "opacity-80"
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {/* Emoji Icon */}
        <span className="text-base shrink-0 select-none">{note.icon}</span>

        {/* Title / Input */}
        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <input
              type="text"
              value={renamingTitle}
              onChange={(e) => setRenamingTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onRenameSubmit(note.id);
                if (e.key === "Escape") onRenameCancel();
              }}
              onBlur={() => onRenameSubmit(note.id)}
              className="w-full text-xs font-semibold px-1 py-0.5 rounded border border-ring bg-white outline-none focus:ring-1 focus:ring-ring"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <p className={cn("truncate text-xs font-semibold", isActive ? "text-foreground" : "text-slate-800")}>
                {note.title.trim() === "" ? "Untitled Note" : note.title}
              </p>
              <p className="text-[9px] text-muted-foreground/75 mt-0.5">
                {new Date(note.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Badges / Options toggle */}
      <div className="flex items-center gap-1 shrink-0">
        {note.isPinned && !note.isTrash && !isRenaming && (
          <Pin className="h-3 w-3 fill-amber-500 text-amber-500 shrink-0" />
        )}
        
        {!isRenaming && (
          <button
            onClick={onOpenMenu}
            className="opacity-0 group-hover:opacity-100 h-6 w-6 rounded-md hover:bg-slate-200/50 flex items-center justify-center transition shrink-0"
            title="Options"
          >
            <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}

// 2. Options Dropdown Menu Component
type OptionsMenuProps = {
  note: Note;
  onClose: () => void;
  onPinToggle: (note: Note) => void;
  onDuplicate: (note: Note) => void;
  onRenameTrigger: (note: Note) => void;
  onColorChange: (note: Note, color: string) => void;
  onIconChange: (note: Note, icon: string) => void;
  onTrashToggle: (note: Note) => void;
  onDeletePermanent: (note: Note) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
};

function OptionsMenu({
  note,
  onClose,
  onPinToggle,
  onDuplicate,
  onRenameTrigger,
  onColorChange,
  onIconChange,
  onTrashToggle,
  onDeletePermanent,
  menuRef,
}: OptionsMenuProps) {
  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 bg-white border border-border rounded-lg shadow-2xl p-2 font-sans text-xs flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Title */}
      <div className="px-2 py-1 border-b border-border/50 flex items-center justify-between">
        <span className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground truncate">Note Options</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-[10px] font-bold">Close</button>
      </div>

      {note.isTrash ? (
        <>
          <button
            onClick={() => onTrashToggle(note)}
            className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-slate-100 transition flex items-center gap-2 font-semibold text-emerald-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restore Note
          </button>
          <button
            onClick={() => onDeletePermanent(note)}
            className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-red-50 text-red-600 transition flex items-center gap-2 font-semibold"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Permanently
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => onPinToggle(note)}
            className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-slate-100 transition flex items-center gap-2 font-semibold text-slate-800"
          >
            <Pin className="h-3.5 w-3.5 text-amber-500 fill-amber-500/20" />
            {note.isPinned ? "Unpin Note" : "Pin/Favorite Note"}
          </button>
          <button
            onClick={() => onRenameTrigger(note)}
            className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-slate-100 transition flex items-center gap-2 font-semibold text-slate-800"
          >
            <FileText className="h-3.5 w-3.5 text-blue-500" />
            Rename Note
          </button>
          <button
            onClick={() => onDuplicate(note)}
            className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-slate-100 transition flex items-center gap-2 font-semibold text-slate-800"
          >
            <Copy className="h-3.5 w-3.5 text-emerald-500" />
            Duplicate Note
          </button>

          {/* Color swatches */}
          <div className="border-t border-border/50 pt-2 flex flex-col gap-1">
            <span className="px-2 text-[8px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Palette className="h-3 w-3" /> Note color
            </span>
            <div className="flex items-center gap-1.5 px-2 py-1">
              {NOTE_COLORS.map((c) => (
                <button
                  key={c.name}
                  onClick={() => onColorChange(note, c.name)}
                  className={cn(
                    "h-5 w-5 rounded-full border border-border/60 transition hover:scale-110 relative shrink-0",
                    c.dot,
                    note.color === c.name && "ring-2 ring-ring ring-offset-1"
                  )}
                  title={c.name}
                >
                  {note.color === c.name && (
                    <Check className="h-2.5 w-2.5 text-white absolute inset-0 m-auto font-bold" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Icon Selector grid */}
          <div className="border-t border-border/50 pt-2 flex flex-col gap-1">
            <span className="px-2 text-[8px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Smile className="h-3 w-3" /> Choose icon
            </span>
            <div className="grid grid-cols-6 gap-1 px-2 py-1 max-h-24 overflow-y-auto">
              {NOTE_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => onIconChange(note, emoji)}
                  className={cn(
                    "h-6 w-6 text-sm hover:bg-slate-100 rounded flex items-center justify-center transition",
                    note.icon === emoji && "bg-slate-100 ring-1 ring-ring/40"
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Trash Action */}
          <div className="border-t border-border/50 pt-1.5">
            <button
              onClick={() => onTrashToggle(note)}
              className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-red-50 text-red-500 transition flex items-center gap-2 font-semibold"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete note
            </button>
          </div>
        </>
      )}
    </div>
  );
}
