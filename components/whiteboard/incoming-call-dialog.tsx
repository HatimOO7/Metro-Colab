"use client";

import { Phone, PhoneOff } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type IncomingCallPayload = {
  callId: string;
  boardId: number;
  boardName: string;
  callerName: string;
  callerEmail: string;
  roomName: string;
  timestamp: number;
};

type IncomingCallDialogProps = {
  call: IncomingCallPayload | null;
  onAccept: (call: IncomingCallPayload) => void;
  onDecline: (call: IncomingCallPayload) => void;
};

export function IncomingCallDialog({ call, onAccept, onDecline }: IncomingCallDialogProps) {
  return (
    <Dialog open={Boolean(call)} onOpenChange={(open) => !open && call && onDecline(call)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
            </span>
            Incoming video call
          </DialogTitle>
          <DialogDescription>
            {call
              ? `${call.callerName} is calling you for "${call.boardName}".`
              : "A collaborator is starting a live session."}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="hover:bg-red-50 hover:text-destructive"
            onClick={() => call && onDecline(call)}
          >
            <PhoneOff className="mr-2 h-4 w-4" />
            Decline
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => call && onAccept(call)}
          >
            <Phone className="mr-2 h-4 w-4" />
            Accept
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
