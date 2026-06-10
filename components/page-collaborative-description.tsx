"use client";

import * as React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useLiveblocksExtension, FloatingToolbar } from "@liveblocks/react-tiptap";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function plainTextToInitialHtml(text: string | null | undefined): string {
  if (!text?.trim()) return "";
  return text
    .split("\n")
    .map((line) => `<p>${line || "<br>"}</p>`)
    .join("");
}

export function PageCollaborativeDescription({
  initialPlainText,
  className,
}: {
  initialPlainText?: string | null;
  className?: string;
}) {
  const initialContent = React.useMemo(
    () => plainTextToInitialHtml(initialPlainText),
    // Only seed from Postgres on first mount per page
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const liveblocks = useLiveblocksExtension({
    field: "description",
    initialContent: initialContent || undefined,
    comments: false,
  });

  const editor = useEditor({
    extensions: [
      liveblocks,
      StarterKit.configure({
        undoRedo: false,
      }),
      Placeholder.configure({
        placeholder: "Write a collaborative description…",
      }),
    ],
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[120px] px-3 py-2 text-sm leading-relaxed text-foreground focus:outline-none",
      },
    },
    immediatelyRender: false,
  });

  if (!editor) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading editor…
      </div>
    );
  }

  return (
    <div className={cn("relative rounded-lg border border-border bg-white", className)}>
      <EditorContent editor={editor} />
      <FloatingToolbar editor={editor} />
    </div>
  );
}
