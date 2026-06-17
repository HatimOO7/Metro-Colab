"use client";

import { useUser } from "@clerk/nextjs";
import {
  ClientSideSuspense,
  LiveblocksProvider,
  RoomProvider,
} from "@liveblocks/react/suspense";
import {
  Download,
  Edit3,
  Loader2,
  PenLine,
  Plus,
  Radio,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { AiDiagramDialog } from "@/components/whiteboard/ai-diagram-dialog";
import { ManageUsersDialog } from "@/components/whiteboard/manage-users-dialog";
import { WhiteboardInviteDialog } from "@/components/whiteboard/whiteboard-invite-dialog";
import {
  WhiteboardCanvas,
  whiteboardInitialStorage,
  type WhiteboardCanvasHandle,
} from "@/components/whiteboard/whiteboard-canvas";
import { VideoCallPanel } from "@/components/whiteboard/video-call-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWorkspaceData } from "@/components/workspace-data";
import { boardColors } from "@/lib/whiteboard-shared";
import { cn } from "@/lib/utils";
import { useOthers } from "@liveblocks/react/suspense";

export type WhiteboardRecord = {
  id: number;
  userId?: number;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  role?: "owner" | "collaborator";
  ownerEmail?: string | null;
};

type BoardForm = {
  name: string;
  color: string;
};

const stickyColors = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#ddd6fe"];

function formatBoardDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

async function readPayload(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed");
  }
  return payload;
}

function AvatarStack() {
  const others = useOthers();
  const visible = others.slice(0, 4);

  if (visible.length === 0) {
    return null;
  }

  return (
    <div className="flex -space-x-2">
      {visible.map(({ connectionId, info }) => (
        <div
          key={connectionId}
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-fuchsia-500 text-[10px] font-semibold text-white shadow-sm"
          title={info?.name ?? "Collaborator"}
        >
          {(info?.name ?? "?").slice(0, 1).toUpperCase()}
        </div>
      ))}
      {others.length > 4 && (
        <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-muted text-[10px] font-semibold text-muted-foreground">
          +{others.length - 4}
        </div>
      )}
    </div>
  );
}

function WhiteboardRoom({
  board,
  userName,
  isOwner,
  saveStatus,
  onSaveStatusChange,
  canvasRef,
  strokeColor,
  liveOpen,
  onLiveOpenChange,
  onGoLive,
  ringing,
  aiOpen,
  onAiOpenChange,
  onExport,
  onAddSticky,
  onInviteOpen,
  onManageUsersOpen,
}: {
  board: WhiteboardRecord;
  userName: string;
  isOwner: boolean;
  saveStatus: "saved" | "saving" | "idle";
  onSaveStatusChange: (status: "saved" | "saving" | "idle") => void;
  canvasRef: React.RefObject<WhiteboardCanvasHandle | null>;
  strokeColor: string;
  liveOpen: boolean;
  onLiveOpenChange: (open: boolean) => void;
  onGoLive: () => void;
  ringing: boolean;
  aiOpen: boolean;
  onAiOpenChange: (open: boolean) => void;
  onExport: () => void;
  onAddSticky: (color: string) => void;
  onInviteOpen: () => void;
  onManageUsersOpen: () => void;
}) {
  return (
    <>
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-background/90 px-3 py-2 backdrop-blur sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: board.color }}
          />
          <h2 className="truncate text-sm font-semibold sm:text-base">
            {board.name}
          </h2>
          <span className="text-[10px] text-muted-foreground">
            {saveStatus === "saving"
              ? "Saving…"
              : saveStatus === "saved"
                ? "Saved"
                : ""}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <AvatarStack />

          <TooltipProvider delayDuration={200}>
            <div className="hidden items-center gap-1 sm:flex">
              {stickyColors.map((color) => (
                <Tooltip key={color}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="h-6 w-6 rounded-md border border-border shadow-sm"
                      style={{ backgroundColor: color }}
                      onClick={() => onAddSticky(color)}
                      aria-label="Add sticky note"
                    />
                  </TooltipTrigger>
                  <TooltipContent>Sticky note</TooltipContent>
                </Tooltip>
              ))}
            </div>

            {isOwner && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-lg bg-white text-xs"
                    onClick={onInviteOpen}
                  >
                    <UserPlus
                      className="mr-1.5 h-3.5 w-3.5 text-sky-600"
                      aria-hidden="true"
                    />
                    Invite
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Invite a registered collaborator
                </TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-lg bg-white text-xs"
                  onClick={onManageUsersOpen}
                >
                  <Users
                    className="mr-1.5 h-3.5 w-3.5 text-indigo-600"
                    aria-hidden="true"
                  />
                  Manage
                </Button>
              </TooltipTrigger>
              <TooltipContent>View board members and access</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-lg bg-white text-xs"
                  onClick={onGoLive}
                  disabled={ringing}
                >
                  {ringing ? (
                    <Loader2
                      className="mr-1.5 h-3.5 w-3.5 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Radio
                      className="mr-1.5 h-3.5 w-3.5 text-red-500"
                      aria-hidden="true"
                    />
                  )}
                  Go Live
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Ring collaborators, then start the call
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-lg bg-white text-xs"
                  onClick={() => onAiOpenChange(true)}
                >
                  <Sparkles
                    className="mr-1.5 h-3.5 w-3.5 text-fuchsia-600"
                    aria-hidden="true"
                  />
                  AI Diagram
                </Button>
              </TooltipTrigger>
              <TooltipContent>Generate diagram with Gemini</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-lg bg-white text-xs"
                  onClick={onExport}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  Export PNG
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download canvas as PNG</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <WhiteboardCanvas
          boardName={board.name}
          userName={userName}
          strokeColor={strokeColor}
          onSaveStatusChange={onSaveStatusChange}
          canvasRef={canvasRef}
        />
      </div>

      {liveOpen && (
        <VideoCallPanel
          roomName={`whiteboard-${board.id}`}
          onClose={() => onLiveOpenChange(false)}
        />
      )}

      <AiDiagramDialog
        open={aiOpen}
        onOpenChange={onAiOpenChange}
        onGenerated={(diagram) => canvasRef.current?.injectDiagram(diagram)}
      />
    </>
  );
}

export function WhiteboardPage() {
  const { user } = useUser();
  const { pendingWhiteboardSelection, clearWhiteboardSelection } =
    useWorkspaceData();
  const [boards, setBoards] = React.useState<WhiteboardRecord[]>([]);
  const [selectedBoardId, setSelectedBoardId] = React.useState<number | null>(
    null,
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [boardDialogOpen, setBoardDialogOpen] = React.useState(false);
  const [editingBoard, setEditingBoard] =
    React.useState<WhiteboardRecord | null>(null);
  const [boardForm, setBoardForm] = React.useState<BoardForm>({
    name: "",
    color: boardColors[0],
  });
  const [saveStatus, setSaveStatus] = React.useState<
    "saved" | "saving" | "idle"
  >("idle");
  const [liveOpen, setLiveOpen] = React.useState(false);
  const [ringing, setRinging] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [manageUsersOpen, setManageUsersOpen] = React.useState(false);
  const [aiOpen, setAiOpen] = React.useState(false);
  const [strokeColor, setStrokeColor] = React.useState("#1e1e1e");
  const canvasRef = React.useRef<WhiteboardCanvasHandle | null>(null);

  const userName =
    user?.firstName?.trim() ||
    user?.emailAddresses[0]?.emailAddress ||
    "Collaborator";

  const selectedBoard =
    boards.find((board) => board.id === selectedBoardId) ?? null;
  const isOwner = selectedBoard?.role === "owner";

  async function handleGoLive() {
    if (!selectedBoard || liveOpen) {
      return;
    }

    setRinging(true);

    try {
      const response = await fetch(
        `/api/whiteboards/${selectedBoard.id}/call/ring`,
        {
          method: "POST",
        },
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to start call");
      }

      setLiveOpen(true);
      toast.success("Calling collaborators…");
    } catch (ringError) {
      toast.error(
        ringError instanceof Error
          ? ringError.message
          : "Unable to ring collaborators",
      );
    } finally {
      setRinging(false);
    }
  }

  const loadBoards = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = await readPayload(await fetch("/api/whiteboards"));
      const nextBoards = (payload.boards ?? []) as WhiteboardRecord[];
      setBoards(nextBoards);
      setSelectedBoardId((current) => current ?? nextBoards[0]?.id ?? null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load whiteboards",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadBoards();
  }, [loadBoards]);

  React.useEffect(() => {
    if (pendingWhiteboardSelection) {
      setSelectedBoardId(pendingWhiteboardSelection);
      clearWhiteboardSelection();
    }
  }, [pendingWhiteboardSelection, clearWhiteboardSelection]);

  async function handleSaveBoard() {
    const name = boardForm.name.trim() || "Untitled whiteboard";
    try {
      if (editingBoard) {
        const payload = await readPayload(
          await fetch(`/api/whiteboards/${editingBoard.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, color: boardForm.color }),
          }),
        );
        const updated = payload.board as WhiteboardRecord;
        setBoards((current) =>
          current.map((board) => (board.id === updated.id ? updated : board)),
        );
      } else {
        const payload = await readPayload(
          await fetch("/api/whiteboards", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, color: boardForm.color }),
          }),
        );
        const created = payload.board as WhiteboardRecord;
        setBoards((current) => [created, ...current]);
        setSelectedBoardId(created.id);
      }

      setBoardDialogOpen(false);
      setEditingBoard(null);
    } catch (saveError) {
      toast.error(
        saveError instanceof Error ? saveError.message : "Unable to save board",
      );
    }
  }

  async function handleDeleteBoard(board: WhiteboardRecord) {
    try {
      await readPayload(
        await fetch(`/api/whiteboards/${board.id}`, {
          method: "DELETE",
        }),
      );
      setBoards((current) => {
        const next = current.filter((item) => item.id !== board.id);
        setSelectedBoardId((selected) =>
          selected === board.id ? (next[0]?.id ?? null) : selected,
        );
        return next;
      });
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete board",
      );
    }
  }

  function openCreateDialog() {
    setEditingBoard(null);
    setBoardForm({ name: "", color: boardColors[0] });
    setBoardDialogOpen(true);
  }

  function openEditDialog(board: WhiteboardRecord) {
    setEditingBoard(board);
    setBoardForm({ name: board.name, color: board.color });
    setBoardDialogOpen(true);
  }

  return (
    <LiveblocksProvider
      authEndpoint="/api/liveblocks-auth"
      resolveUsers={async ({ userIds }) => {
        try {
          const searchParams = new URLSearchParams();
          userIds.forEach((id) => searchParams.append("userIds", id));
          const response = await fetch(`/api/liveblocks-users?${searchParams}`);
          if (!response.ok) {
            return [];
          }
          return response.json();
        } catch {
          return [];
        }
      }}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-b border-border bg-card lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Whiteboards</p>
                <p className="text-[10px] text-muted-foreground">
                  {boards.length} boards
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={openCreateDialog}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-1 p-2">
                {loading && (
                  <>
                    <div className="h-14 animate-pulse rounded-lg bg-muted" />
                    <div className="h-14 animate-pulse rounded-lg bg-muted" />
                  </>
                )}

                {!loading && boards.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border p-4 text-xs leading-5 text-muted-foreground">
                    Create a whiteboard to start drawing with your team.
                  </div>
                )}

                {!loading &&
                  boards.map((board) => (
                    <div
                      key={board.id}
                      className={cn(
                        "group flex items-center gap-2 rounded-lg border px-2 py-2 transition",
                        selectedBoardId === board.id
                          ? "border-fuchsia-200 bg-fuchsia-50 shadow-soft"
                          : "border-transparent hover:bg-white/80",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedBoardId(board.id)}
                        className="flex min-w-0 flex-1 items-start gap-2 text-left"
                      >
                        <span
                          className="mt-1 h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: board.color }}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">
                            {board.name}
                          </span>
                          <span className="block truncate text-[10px] text-muted-foreground">
                            {formatBoardDate(board.updatedAt)}
                          </span>
                        </span>
                      </button>
                      {board.role === "owner" && (
                        <button
                          type="button"
                          onClick={() => openEditDialog(board)}
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground opacity-0 transition hover:bg-white hover:text-foreground group-hover:opacity-100"
                          aria-label={`Rename ${board.name}`}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {board.role === "owner" && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteBoard(board)}
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground opacity-0 transition hover:bg-red-50 hover:text-destructive group-hover:opacity-100"
                          aria-label={`Delete ${board.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </ScrollArea>

            <div className="border-t border-border p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Stroke color
              </p>
              <div className="flex flex-wrap gap-1.5">
                {boardColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      "h-6 w-6 rounded-full border-2",
                      strokeColor === color
                        ? "border-foreground"
                        : "border-transparent",
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => {
                      setStrokeColor(color);
                      canvasRef.current?.setStrokeColor(color);
                    }}
                    aria-label={`Set stroke color ${color}`}
                  />
                ))}
              </div>
            </div>
          </aside>

          <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {error && (
              <div className="border-b border-destructive/25 bg-red-50 px-4 py-2 text-sm text-destructive">
                {error}
                <button
                  type="button"
                  className="ml-2 font-semibold underline"
                  onClick={() => void loadBoards()}
                >
                  Retry
                </button>
              </div>
            )}

            {loading ? (
              <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                Loading whiteboards…
              </div>
            ) : !selectedBoard ? (
              <div className="grid flex-1 place-items-center p-6 text-center">
                <div>
                  <PenLine
                    className="mx-auto h-10 w-10 text-fuchsia-600"
                    aria-hidden="true"
                  />
                  <p className="mt-3 text-sm font-semibold">
                    No whiteboard selected
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Create a board to open the canvas.
                  </p>
                  <Button
                    type="button"
                    className="mt-4 h-9 rounded-lg text-xs"
                    onClick={openCreateDialog}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    New whiteboard
                  </Button>
                </div>
              </div>
            ) : (
              <RoomProvider
  key={selectedBoard.id}
  id={`whiteboard-${selectedBoard.id}`}
  initialPresence={{ cursor: null, name: userName, color: boardColors[0] }}
  initialStorage={whiteboardInitialStorage}
>
                <ClientSideSuspense
                  fallback={
                    <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
                      Loading collaboration…
                    </div>
                  }
                >
                  <WhiteboardRoom
                    board={selectedBoard}
                    userName={userName}
                    isOwner={Boolean(isOwner)}
                    saveStatus={saveStatus}
                    onSaveStatusChange={setSaveStatus}
                    canvasRef={canvasRef}
                    strokeColor={strokeColor}
                    liveOpen={liveOpen}
                    onLiveOpenChange={setLiveOpen}
                    onGoLive={() => void handleGoLive()}
                    ringing={ringing}
                    aiOpen={aiOpen}
                    onAiOpenChange={setAiOpen}
                    onExport={() => void canvasRef.current?.exportPng()}
                    onAddSticky={(color) =>
                      canvasRef.current?.addStickyNote(color)
                    }
                    onInviteOpen={() => setInviteOpen(true)}
                    onManageUsersOpen={() => setManageUsersOpen(true)}
                  />
                </ClientSideSuspense>
              </RoomProvider>
            )}
          </section>
        </div>
      </div>

      {selectedBoard && (
        <>
          <WhiteboardInviteDialog
            open={inviteOpen}
            onOpenChange={setInviteOpen}
            boardId={selectedBoard.id}
            boardName={selectedBoard.name}
          />
          <ManageUsersDialog
            open={manageUsersOpen}
            onOpenChange={setManageUsersOpen}
            boardId={selectedBoard.id}
          />
        </>
      )}

      <Dialog open={boardDialogOpen} onOpenChange={setBoardDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingBoard ? "Rename whiteboard" : "New whiteboard"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {editingBoard
                ? "Rename your existing whiteboard."
                : "Create a new whiteboard here."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="board-name">Name</Label>
              <Input
                id="board-name"
                value={boardForm.name}
                onChange={(event) =>
                  setBoardForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Design sprint"
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {boardColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      "h-8 w-8 rounded-full border-2",
                      boardForm.color === color
                        ? "border-foreground"
                        : "border-transparent",
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() =>
                      setBoardForm((current) => ({ ...current, color }))
                    }
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBoardDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSaveBoard()}>
              {editingBoard ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LiveblocksProvider>
  );
}
