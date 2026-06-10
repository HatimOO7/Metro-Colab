"use client";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { LiveObject } from "@liveblocks/client";
import {
  useMutation,
  useOthers,
  useSelf,
  useStorage,
  useUpdateMyPresence,
} from "@liveblocks/react/suspense";
import dynamic from "next/dynamic";
import * as React from "react";

import { diagramToExcalidrawElements, type DiagramPayload } from "@/lib/excalidraw-diagram";
import { WhiteboardCursors } from "@/components/whiteboard/whiteboard-cursors";

import "@excalidraw/excalidraw/index.css";

const Excalidraw = dynamic(async () => (await import("@excalidraw/excalidraw")).Excalidraw, {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading canvas…</div>
  ),
});

const CURSOR_COLORS = ["#0ea5e9", "#10b981", "#f97316", "#e11d48", "#7c3aed", "#14b8a6"];

export type WhiteboardCanvasHandle = {
  exportPng: () => Promise<void>;
  injectDiagram: (diagram: DiagramPayload) => void;
  addStickyNote: (color: string) => void;
  setStrokeColor: (color: string) => void;
};

type WhiteboardCanvasProps = {
  boardName: string;
  userName: string;
  strokeColor: string;
  onSaveStatusChange: (status: "saved" | "saving" | "idle") => void;
  canvasRef: React.RefObject<WhiteboardCanvasHandle | null>;
};

function randomId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function CanvasInner({
  boardName,
  userName,
  strokeColor,
  onSaveStatusChange,
  canvasRef,
}: WhiteboardCanvasProps): React.ReactElement {
  const excalidrawRef = React.useRef<ExcalidrawImperativeAPI | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const isRemoteUpdate = React.useRef(false);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveblocksSelf = useSelf();
  const others = useOthers();
  const updatePresence = useUpdateMyPresence();

  const storedElementsJson = useStorage((root) => {
    const canvas = root.canvas as { elementsJson?: string; version?: number } | undefined;
    return canvas?.elementsJson ?? "[]";
  });
  const storageVersion = useStorage((root) => {
    const canvas = root.canvas as { version?: number } | undefined;
    return canvas?.version ?? 0;
  });


  const sanitizeElements = (elements: any[]): ExcalidrawElement[] => {
    if (!elements || !Array.isArray(elements)) return [];

    // Create a map of all valid IDs currently in the payload
    const validIds = new Set(elements.map((el) => el.id));

    return elements.map((el) => {
      // 1. Completely remove fractionalIndex to force Excalidraw to recalculate z-index
      const { fractionalIndex, ...safeElement } = el;

      // 2. Fix boundElements (children attached to this shape)
      let validBoundElements = safeElement.boundElements;
      if (Array.isArray(safeElement.boundElements)) {
        const filtered = safeElement.boundElements.filter(
          (b: any) => b && typeof b.id === "string" && validIds.has(b.id)
        );
        validBoundElements = filtered.length ? filtered : null;
      }

      // 3. Fix containerId (if this text is bound to a parent shape that doesn't exist)
      let validContainerId = safeElement.containerId;
      if (validContainerId && !validIds.has(validContainerId)) {
        validContainerId = null;
      }

      return {
        ...safeElement,
        boundElements: validBoundElements,
        containerId: validContainerId
      } as ExcalidrawElement;
    });
  };

  const storedElements = React.useMemo(() => {
    try {
      return JSON.parse(storedElementsJson) as ExcalidrawElement[];
    } catch {
      return [] as ExcalidrawElement[];
    }
  }, [storedElementsJson]);

  const updateCanvas = useMutation(({ storage }, elements: readonly ExcalidrawElement[]) => {
    const canvas = storage.get("canvas") as LiveObject<{
      elementsJson: string;
      version: number;
    }> | null;

    if (!canvas) {
      return;
    }

    canvas.set("elementsJson", JSON.stringify(elements));
    canvas.set("version", (canvas.get("version") ?? 0) + 1);
  }, []);

  React.useEffect(() => {
    if (!excalidrawRef.current || isRemoteUpdate.current) {
      return;
    }

    isRemoteUpdate.current = true;
    try {
      // Sanitize elements to avoid Excalidraw invariant errors
      const safeElements = sanitizeElements(storedElements ?? []);
      excalidrawRef.current.updateScene({
        elements: safeElements as unknown as ExcalidrawElement[],
      });
    } catch (error) {
      console.error("Excalidraw updateScene prevented a crash:", error);
    } finally {
      isRemoteUpdate.current = false;
    }
  }, [storageVersion, storedElements]);
  React.useEffect(() => {
    const connectionId = liveblocksSelf?.connectionId ?? 0;
    updatePresence({
      name: userName,
      color: CURSOR_COLORS[connectionId % CURSOR_COLORS.length],
    });
  }, [liveblocksSelf?.connectionId, updatePresence, userName]);

  const handleChange = React.useCallback(
    (elements: readonly ExcalidrawElement[]) => {
      if (isRemoteUpdate.current) {
        return;
      }

      onSaveStatusChange("saving");

      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }

      saveTimer.current = setTimeout(() => {
        updateCanvas(elements);
        onSaveStatusChange("saved");
        saveTimer.current = setTimeout(() => onSaveStatusChange("idle"), 1500);
      }, 400);
    },
    [onSaveStatusChange, updateCanvas]
  );

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      updatePresence({
        cursor: {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        },
      });
    },
    [updatePresence]
  );

  const handlePointerLeave = React.useCallback(() => {
    updatePresence({ cursor: null });
  }, [updatePresence]);

  React.useImperativeHandle(canvasRef, () => ({
    async exportPng() {
      const api = excalidrawRef.current;
      if (!api) {
        return;
      }

      const { exportToBlob } = await import("@excalidraw/excalidraw");
      const blob = await exportToBlob({
        elements: api.getSceneElements(),
        appState: {
          ...api.getAppState(),
          exportBackground: true,
        },
        files: api.getFiles(),
        mimeType: "image/png",
      });

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${boardName.replace(/\s+/g, "-").toLowerCase() || "whiteboard"}.png`;
      anchor.click();
      URL.revokeObjectURL(url);
    },
    injectDiagram(diagram: DiagramPayload) {
      const api = excalidrawRef.current;
      if (!api) {
        return;
      }

      const newElements = diagramToExcalidrawElements(diagram);
      const existing = api.getSceneElements();
      api.updateScene({ elements: [...existing, ...newElements] });
      handleChange(api.getSceneElements());
    },
    addStickyNote(color: string) {
      const api = excalidrawRef.current;
      if (!api) {
        return;
      }

      const shapeId = randomId("sticky");
      const textId = randomId("sticky-text");
      const appState = api.getAppState();
      const x = -appState.scrollX + 120;
      const y = -appState.scrollY + 120;
      const now = Date.now();

      const shape = {
        id: shapeId,
        type: "rectangle",
        x,
        y,
        width: 180,
        height: 120,
        angle: 0,
        strokeColor: "#1e1e1e",
        backgroundColor: color,
        fillStyle: "solid",
        strokeWidth: 2,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: { type: 3 },
        seed: now,
        version: 1,
        versionNonce: now + 1,
        isDeleted: false,
        boundElements: [{ id: textId, type: "text" }],
        updated: now,
        link: null,
        locked: false,
      } as unknown as ExcalidrawElement;

      const text = {
        id: textId,
        type: "text",
        x: x + 12,
        y: y + 24,
        width: 156,
        height: 24,
        angle: 0,
        strokeColor: "#1e1e1e",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 1,
        strokeStyle: "solid",
        roughness: 0,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: null,
        seed: now + 2,
        version: 1,
        versionNonce: now + 3,
        isDeleted: false,
        boundElements: null,
        updated: now,
        link: null,
        locked: false,
        text: "Sticky note",
        fontSize: 16,
        fontFamily: 1,
        textAlign: "left",
        verticalAlign: "top",
        containerId: shapeId,
        originalText: "Sticky note",
        lineHeight: 1.25,
        autoResize: true,
      } as unknown as ExcalidrawElement;

      const existing = api.getSceneElements();
      api.updateScene({ elements: [...existing, shape, text] });
      handleChange(api.getSceneElements());
    },
    setStrokeColor(color: string) {
      const api = excalidrawRef.current;
      if (!api) {
        return;
      }

      api.updateScene({
        appState: {
          ...api.getAppState(),
          currentItemStrokeColor: color,
        },
      });
    },
  }));

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-0 w-full overflow-hidden"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <Excalidraw
        excalidrawAPI={(api) => {
          excalidrawRef.current = api;
        }}
        onChange={handleChange}
        initialData={{
          elements: sanitizeElements(storedElements ?? []) as unknown as ExcalidrawElement[],
          appState: {
            viewBackgroundColor: "#fafafa",
            currentItemStrokeColor: strokeColor,
          },
        }}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            export: false,
            saveAsImage: false,
          },
        }}
      />
      <WhiteboardCursors />
      {others.length > 0 && (
        <div className="pointer-events-none absolute right-3 top-3 z-[55] rounded-lg bg-white/90 px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-sm">
          {others.length + 1} online
        </div>
      )}
    </div>
  );
}

export function WhiteboardCanvas(props: WhiteboardCanvasProps) {
  return <CanvasInner {...props} />;
}

export function whiteboardInitialStorage() {
  return {
    canvas: new LiveObject({
      elementsJson: "[]",
      version: 0,
    }),
  };
}