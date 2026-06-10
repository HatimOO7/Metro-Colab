"use client";

import { Loader2, Search, UserMinus, UserPlus, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type SearchUser = {
  id: number;
  email: string;
  name: string;
  imageUrl: string | null;
};

type Member = {
  id: number;
  email: string;
  name: string;
  imageUrl: string | null;
  role: "owner" | "collaborator";
};

type PendingInvite = {
  id: number;
  email: string;
  name: string;
  imageUrl: string | null;
};

type SpaceInviteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceId: number;
  spaceName: string;
  isOwner: boolean;
};

export function SpaceInviteDialog({
  open,
  onOpenChange,
  spaceId,
  spaceName,
  isOwner,
}: SpaceInviteDialogProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchUser[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [invitingEmail, setInvitingEmail] = React.useState<string | null>(null);
  const [loadingMembers, setLoadingMembers] = React.useState(false);
  const [owner, setOwner] = React.useState<Member | null>(null);
  const [collaborators, setCollaborators] = React.useState<Member[]>([]);
  const [pendingInvites, setPendingInvites] = React.useState<PendingInvite[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const loadMembers = React.useCallback(async () => {
    setLoadingMembers(true);
    try {
      const response = await fetch(`/api/spaces/${spaceId}/members`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to load members");
      setOwner(payload.owner ?? null);
      setCollaborators(payload.collaborators ?? []);
      setPendingInvites(payload.pendingInvites ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load members");
    } finally {
      setLoadingMembers(false);
    }
  }, [spaceId]);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setError(null);
      return;
    }
    void loadMembers();
  }, [open, loadMembers]);

  React.useEffect(() => {
    if (!open || !isOwner || query.trim().length < 2) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Search failed");
        setResults(payload.users ?? []);
      } catch (searchError) {
        if (searchError instanceof Error && searchError.name !== "AbortError") {
          setError(searchError.message);
        }
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [open, isOwner, query]);

  async function inviteUser(email: string) {
    setInvitingEmail(email);
    setError(null);
    try {
      const response = await fetch(`/api/spaces/${spaceId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to send invite");
      toast.success(`Invitation sent to ${email}`);
      await loadMembers();
      setQuery("");
      setResults([]);
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Unable to send invite");
    } finally {
      setInvitingEmail(null);
    }
  }

  async function revokeInvite(invitationId: number) {
    try {
      const response = await fetch(`/api/spaces/invitations/${invitationId}/revoke`, {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to revoke");
      toast.success("Invitation revoked");
      await loadMembers();
    } catch (revokeError) {
      toast.error(revokeError instanceof Error ? revokeError.message : "Failed to revoke");
    }
  }

  async function removeCollaborator(email: string) {
    try {
      const response = await fetch(`/api/spaces/${spaceId}/share`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to remove");
      toast.success("Collaborator removed");
      await loadMembers();
    } catch (removeError) {
      toast.error(removeError instanceof Error ? removeError.message : "Failed to remove");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite collaborators</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Manage access to &quot;{spaceName}&quot;. Only registered users can be invited.
        </p>

        {isOwner && (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or email"
                className="pl-9"
              />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <ScrollArea className="max-h-40 rounded-lg border border-border">
              <div className="p-2">
                {searching && (
                  <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Searching users…
                  </div>
                )}
                {!searching && query.trim().length >= 2 && results.length === 0 && (
                  <p className="px-2 py-3 text-xs text-muted-foreground">No registered users found.</p>
                )}
                {results.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-muted/50"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar imageUrl={user.imageUrl} name={user.name} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{user.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 shrink-0 rounded-lg text-xs"
                      disabled={invitingEmail === user.email}
                      onClick={() => void inviteUser(user.email)}
                    >
                      {invitingEmail === user.email ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                          Invite
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        <div className="space-y-3">
          <p className="text-xs font-semibold text-foreground">Members</p>
          {loadingMembers ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading…
            </div>
          ) : (
            <div className="space-y-2">
              {owner && (
                <MemberRow member={owner} badge="Owner" />
              )}
              {collaborators.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  badge="Collaborator"
                  action={
                    isOwner ? (
                      <button
                        type="button"
                        onClick={() => void removeCollaborator(member.email)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-destructive"
                        title="Remove collaborator"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </button>
                    ) : undefined
                  }
                />
              ))}
            </div>
          )}

          {pendingInvites.length > 0 && (
            <>
              <p className="text-xs font-semibold text-foreground">Pending invitations</p>
              <div className="space-y-2">
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-border px-2 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar imageUrl={invite.imageUrl} name={invite.name} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{invite.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{invite.email}</p>
                      </div>
                    </div>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => void revokeInvite(invite.id)}
                        className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted"
                      >
                        <X className="h-3 w-3" />
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Avatar({ imageUrl, name }: { imageUrl: string | null; name: string }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        name.slice(0, 2).toUpperCase()
      )}
    </div>
  );
}

function MemberRow({
  member,
  badge,
  action,
}: {
  member: Member;
  badge: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-2 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <Avatar imageUrl={member.imageUrl} name={member.name} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{member.name}</p>
          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", badge === "Owner" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700")}>
          {badge}
        </span>
        {action}
      </div>
    </div>
  );
}
