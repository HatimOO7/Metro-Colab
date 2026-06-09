"use client";

import { createClient } from "@liveblocks/client";
import { useUser } from "@clerk/nextjs";
import * as React from "react";

import {
  IncomingCallDialog,
  type IncomingCallPayload,
} from "@/components/whiteboard/incoming-call-dialog";
import { VideoCallPanel } from "@/components/whiteboard/video-call-panel";
import { useWorkspaceData } from "@/components/workspace-data";
import { userInboxRoomId, type IncomingCallEvent } from "@/lib/liveblocks-shared";

type IncomingCallProviderProps = {
  children: React.ReactNode;
  onNavigateToWhiteboard?: () => void;
};

function isIncomingCallEvent(event: unknown): event is IncomingCallEvent {
  return (
    typeof event === "object" &&
    event !== null &&
    (event as IncomingCallEvent).type === "INCOMING_CALL" &&
    typeof (event as IncomingCallEvent).callId === "string"
  );
}

export function IncomingCallProvider({ children, onNavigateToWhiteboard }: IncomingCallProviderProps) {
  const { user } = useUser();
  const { requestWhiteboardSelection } = useWorkspaceData();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? null;
  const [incomingCall, setIncomingCall] = React.useState<IncomingCallPayload | null>(null);
  const [activeCallRoom, setActiveCallRoom] = React.useState<string | null>(null);
  const handledCallIds = React.useRef(new Set<string>());

  const handleIncomingEvent = React.useCallback(
    (event: unknown) => {
      if (!isIncomingCallEvent(event)) {
        return;
      }

      if (handledCallIds.current.has(event.callId)) {
        return;
      }

      if (event.callerEmail.toLowerCase() === email) {
        return;
      }

      handledCallIds.current.add(event.callId);

      setIncomingCall({
        callId: event.callId,
        boardId: event.boardId,
        boardName: event.boardName,
        callerName: event.callerName,
        callerEmail: event.callerEmail,
        roomName: event.roomName,
        timestamp: event.timestamp,
      });
    },
    [email]
  );

  React.useEffect(() => {
    if (!email) {
      return;
    }

    const client = createClient({ authEndpoint: "/api/liveblocks-auth" });
    const { room, leave } = client.enterRoom(userInboxRoomId(email));

    const unsubscribe = room.subscribe("event", ({ event }) => {
      handleIncomingEvent(event);
    });

    return () => {
      unsubscribe();
      leave();
    };
  }, [email, handleIncomingEvent]);

  function acceptCall(call: IncomingCallPayload) {
    setIncomingCall(null);
    onNavigateToWhiteboard?.();
    requestWhiteboardSelection(call.boardId);
    setActiveCallRoom(call.roomName);
  }

  function declineCall(call: IncomingCallPayload) {
    handledCallIds.current.add(call.callId);
    setIncomingCall(null);
  }

  return (
    <>
      {children}
      <IncomingCallDialog call={incomingCall} onAccept={acceptCall} onDecline={declineCall} />
      {activeCallRoom && (
        <VideoCallPanel roomName={activeCallRoom} onClose={() => setActiveCallRoom(null)} connect />
      )}
    </>
  );
}