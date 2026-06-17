"use client";

import { Loader2, Trash2, Users } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

type MemberRecord = {
  email: string;
  name: string;
  imageUrl: string | null;
  role: "owner" | "collaborator";
};

type ManageUsersDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: number;
};

export function ManageUsersDialog({ open, onOpenChange, boardId }: ManageUsersDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [removingEmail, setRemovingEmail] = React.useState<string | null>(null);
  const [isOwner, setIsOwner] = React.useState(false);
  const [owner, setOwner] = React.useState<MemberRecord | null>(null);
  const [collaborators, setCollaborators] = React.useState<MemberRecord[]>([]);
  const [pendingInvites, setPendingInvites] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const loadMembers = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/whiteboards/${boardId}/members`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load members");
      }

      setIsOwner(Boolean(payload.isOwner));
      setOwner(payload.owner ?? null);
      setCollaborators(payload.collaborators ?? []);
      setPendingInvites(payload.pendingInvites ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load members");
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  React.useEffect(() => {
    if (open) {
      void loadMembers();
    }
  }, [open, loadMembers]);

  async function removeCollaborator(email: string) {
    if (!isOwner) {
      return;
    }

    setRemovingEmail(email);
    setError(null);

    try {
      const response = await fetch(`/api/whiteboards/${boardId}/share`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to remove collaborator");
      }

      toast.success("Collaborator removed");
      await loadMembers();
    } catch (removeError) {
      const message = removeError instanceof Error ? removeError.message : "Unable to remove collaborator";
      setError(message);
      toast.error(message);
    } finally {
      setRemovingEmail(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Manage users
          </DialogTitle>
          <DialogDescription className="sr-only">
            Manage whiteboard members, view owners, and pending invites.
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading members…
          </div>
        ) : (
          <ScrollArea className="max-h-72">
            <div className="space-y-4 pr-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Owner</p>
                {owner && (
                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{owner.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{owner.email}</p>
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Owner
                    </span>
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Collaborators
                </p>
                <div className="space-y-2">
                  {collaborators.length === 0 && (
                    <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                      No collaborators yet.
                    </p>
                  )}
                  {collaborators.map((member) => (
                    <div
                      key={member.email}
                      className="flex items-center justify-between rounded-lg border border-border bg-white px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{member.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                      </div>
                      {isOwner ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 text-destructive hover:bg-red-50 hover:text-destructive"
                          disabled={removingEmail === member.email}
                          onClick={() => void removeCollaborator(member.email)}
                        >
                          {removingEmail === member.email ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                              Remove
                            </>
                          )}
                        </Button>
                      ) : (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Collaborator
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {pendingInvites.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Pending invites
                  </p>
                  <div className="space-y-2">
                    {pendingInvites.map((email) => (
                      <div
                        key={email}
                        className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                      >
                        {email}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}