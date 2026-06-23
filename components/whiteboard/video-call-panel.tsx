"use client";

import {
  ControlBar,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { GripHorizontal, Loader2, PhoneOff, Maximize2, Minimize2, X, Minus } from "lucide-react";
import { Track } from "livekit-client";
import * as React from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type VideoCallPanelProps = {
  roomName: string;
  onClose: () => void;
  connect?: boolean;
};

function VideoTiles({ onLocalScreenShareChange }: { onLocalScreenShareChange?: (active: boolean) => void }) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const displayTracks = tracks.filter((t) => {
    if (t.source === Track.Source.ScreenShare && t.participant.isLocal) {
      return false;
    }
    return true;
  });

  const screenShareTrack = displayTracks.find((t) => t.source === Track.Source.ScreenShare);
  const otherTracks = displayTracks.filter((t) => t !== screenShareTrack);

  const localScreenShare = tracks.find(
    (t) => t.source === Track.Source.ScreenShare && t.participant.isLocal
  );

  const isLocalSharing = !!localScreenShare;
  React.useEffect(() => {
    onLocalScreenShareChange?.(isLocalSharing);
  }, [isLocalSharing, onLocalScreenShareChange]);

  return (
    <div className="flex-1 w-full min-h-[280px] h-full relative bg-slate-950/90 rounded-lg overflow-hidden flex flex-col">
      {screenShareTrack ? (
        <div className="flex flex-col h-full w-full">
          <div className="flex-1 w-full relative bg-black">
            <ParticipantTile trackRef={screenShareTrack} className="absolute inset-0 w-full h-full object-contain" />
          </div>

          {otherTracks.length > 0 && (
            <div className="h-[100px] w-full border-t border-slate-800 bg-black/80">
              <GridLayout tracks={otherTracks} className="w-full h-full p-1 gap-1">
                <ParticipantTile />
              </GridLayout>
            </div>
          )}
        </div>
      ) : (
        <GridLayout tracks={displayTracks} className="w-full h-full p-2 gap-2">
          <ParticipantTile />
        </GridLayout>
      )}
    </div>
  );
}

function HangUpButton() {
  const room = useRoomContext();

  return (
    <div className="flex justify-center pt-2 pb-1">
      <Button
        type="button"
        size="sm"
        variant="destructive"
        className="gap-2 rounded-full px-6 font-semibold shadow-md transition-transform hover:scale-105"
        onClick={() => room.disconnect()}
      >
        <PhoneOff className="h-4 w-4" />
        Hang Up
      </Button>
    </div>
  );
}

export function VideoCallPanel({ roomName, onClose, connect = true }: VideoCallPanelProps) {
  const [mounted, setMounted] = React.useState(false);
  const [token, setToken] = React.useState<string | null>(null);
  const [serverUrl, setServerUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(connect);
  const [position, setPosition] = React.useState({ x: 24, y: 80 });

  const [isMaximized, setIsMaximized] = React.useState(false);
  const [isMinimized, setIsMinimized] = React.useState(false);

  const wasAutoMinimized = React.useRef(false);
  const isMinimizedRef = React.useRef(isMinimized);

  const panelRef = React.useRef<HTMLDivElement>(null);
  const dragState = React.useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    isMinimizedRef.current = isMinimized;
  }, [isMinimized]);

  React.useEffect(() => {
    if (!connect) return;
    let disposed = false;

    async function fetchToken() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/livekit/get-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room: roomName }),
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to join call");
        }

        if (!disposed) {
          setToken(payload.token);
          setServerUrl(payload.url);
        }
      } catch (connectError) {
        if (!disposed) {
          const message =
            connectError instanceof Error ? connectError.message : "Unable to start video call";
          setError(message);
          toast.error(message);
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    }

    void fetchToken();

    return () => {
      disposed = true;
    };
  }, [connect, roomName]);

  const handleLocalScreenShareChange = React.useCallback((active: boolean) => {
    if (active && !isMinimizedRef.current) {
      setIsMinimized(true);
      wasAutoMinimized.current = true;
    } else if (!active && wasAutoMinimized.current) {
      setIsMinimized(false);
      wasAutoMinimized.current = false;
    }
  }, []);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (isMaximized) return;
    dragState.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragState.current || isMaximized) return;

    let newX = dragState.current.originX + (event.clientX - dragState.current.startX);
    let newY = dragState.current.originY + (event.clientY - dragState.current.startY);

    if (panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width;
      const maxY = window.innerHeight - rect.height;

      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));
    }

    setPosition({ x: newX, y: newY });
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    dragState.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleManualMinimize() {
    wasAutoMinimized.current = false;
    setIsMinimized(true);
  }

  if (!mounted) return null;

  const panelContent = (
    <>
      {isMinimized && token && (
        <div
          className="fixed bottom-6 left-6 z-[99999] bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-3 cursor-pointer transition-all animate-pulse"
          onClick={() => setIsMinimized(false)}
          title="Click to restore video call panel"
        >
          <div className="h-2 w-2 rounded-full bg-white animate-ping" />
          <span className="text-xs font-semibold tracking-wide">Call Active ({roomName})</span>
          <button
            type="button"
            className="bg-white/20 p-1 rounded-full hover:bg-white/30 text-white"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div
        ref={panelRef}
        className={cn(
          "fixed z-[9999] overflow-hidden border border-border bg-card shadow-2xl transition-all duration-200 ease-in-out flex flex-col",
          isMaximized
            ? "rounded-none w-screen h-screen top-0 left-0"
            : "w-[min(92vw,430px)] rounded-xl",
          isMinimized && "hidden"
        )}
        style={
          isMaximized
            ? { top: 0, left: 0, width: "100vw", height: "100vh" }
            : { left: position.x, top: position.y }
        }
      >
        <div
          className={cn(
            "flex items-center justify-between border-b border-border bg-muted/60 px-3 py-2 select-none",
            isMaximized ? "cursor-default" : "cursor-grab active:cursor-grabbing"
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <div className="flex items-center gap-2 text-xs font-semibold">
            {!isMaximized && <GripHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
            <span className="truncate max-w-[160px]">Live: {roomName}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className={cn("text-[10px] font-medium mr-1.5", token ? "text-emerald-600" : "text-muted-foreground")}>
              {loading ? "Connecting…" : token ? "Connected" : "Offline"}
            </span>

            {token && (
              <>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={handleManualMinimize}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted"
                  title="Minimize to Tray"
                >
                  <Minus className="h-3.5 w-3.5" />
                </                button>

                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setIsMaximized(!isMaximized)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted"
                  title={isMaximized ? "Exit Fullscreen" : "Fullscreen"}
                >
                  {isMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </button>
              </>
            )}

            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onClose}
              className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded hover:bg-muted"
              title="Close Call Panel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 w-full flex flex-col bg-background/40 overflow-hidden">
          {error ? (
            <div className="p-3">
              <p className="rounded-lg border border-destructive/25 bg-red-50 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            </div>
          ) : loading || !token || !serverUrl ? (
            <div className={cn("grid place-items-center w-full", isMaximized ? "flex-1" : "h-60")}>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Joining room…
              </div>
            </div>
          ) : (
            <LiveKitRoom
              token={token}
              serverUrl={serverUrl}
              connect
              audio
              video
              onDisconnected={onClose}
              className="flex flex-col flex-1 w-full h-full p-2 overflow-hidden"
            >
              <VideoTiles onLocalScreenShareChange={handleLocalScreenShareChange} />
              <RoomAudioRenderer />

              <div className="mt-auto pt-2 bg-card/90 rounded-b-lg">
                <ControlBar
                  controls={{
                    microphone: true,
                    camera: true,
                    screenShare: true,
                    leave: false,
                  }}
                />
                <HangUpButton />
              </div>
            </LiveKitRoom>
          )}

          {!token && !loading && (
            <div className="flex justify-end p-3">
              <Button type="button" size="sm" variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(panelContent, document.body);
}