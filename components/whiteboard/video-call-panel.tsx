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
import { GripHorizontal, Loader2, PhoneOff } from "lucide-react";
import { Track } from "livekit-client";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type VideoCallPanelProps = {
  roomName: string;
  onClose: () => void;
  connect?: boolean;
};

function VideoTiles() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  return (
    <GridLayout tracks={tracks} className="min-h-[200px] gap-2">
      <ParticipantTile />
    </GridLayout>
  );
}

function HangUpButton() {
  const room = useRoomContext();

  return (
    <div className="flex justify-center pt-1">
      <Button
        type="button"
        size="sm"
        variant="destructive"
        className="gap-2 rounded-full px-5 font-semibold shadow-md transition-transform hover:scale-105"
        onClick={() => room.disconnect()}
      >
        <PhoneOff className="h-4 w-4" />
        Hang Up
      </Button>
    </div>
  );
}

export function VideoCallPanel({ roomName, onClose, connect = true }: VideoCallPanelProps) {
  const [token, setToken] = React.useState<string | null>(null);
  const [serverUrl, setServerUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(connect);
  const [position, setPosition] = React.useState({ x: 24, y: 80 });
  const dragState = React.useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  React.useEffect(() => {
    if (!connect) {
      return;
    }

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

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    dragState.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragState.current) {
      return;
    }

    setPosition({
      x: dragState.current.originX + (event.clientX - dragState.current.startX),
      y: dragState.current.originY + (event.clientY - dragState.current.startY),
    });
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    dragState.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <div
      className="fixed z-[70] w-[min(92vw,420px)] overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      style={{ left: position.x, top: position.y }}
    >
      <div
        className="flex cursor-grab items-center justify-between border-b border-border bg-muted/50 px-3 py-2 active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div className="flex items-center gap-2 text-xs font-semibold">
          <GripHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Live call
        </div>
        <span className={cn("text-[10px] font-medium", token ? "text-emerald-600" : "text-muted-foreground")}>
          {loading ? "Connecting…" : token ? "Connected" : "Offline"}
        </span>
      </div>

      <div className="space-y-2 p-3">
        {error ? (
          <p className="rounded-lg border border-destructive/25 bg-red-50 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        ) : loading || !token || !serverUrl ? (
          <div className="grid h-48 place-items-center rounded-lg bg-slate-900 text-xs text-slate-300">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Joining room…
          </div>
        ) : (
          <LiveKitRoom
            token={token}
            serverUrl={serverUrl}
            connect
            audio
            video
            onDisconnected={onClose}
            className="space-y-2"
          >
            <VideoTiles />
            <RoomAudioRenderer />
            <ControlBar
              controls={{
                microphone: true,
                camera: true,
                screenShare: true,
                leave: true,
              }}
            />
            <HangUpButton />
          </LiveKitRoom>
        )}

        {!token && !loading && (
          <div className="flex justify-end">
            <Button type="button" size="sm" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}