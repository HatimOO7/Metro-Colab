"use client";

import { Loader2, Search, UserPlus } from "lucide-react";
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
type SearchUser = {
  id: number;
  email: string;
  name: string;
  imageUrl: string | null;
};

type WhiteboardInviteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: number;
  boardName: string;
  onInvited?: () => void;
};

export function WhiteboardInviteDialog({
  open,
  onOpenChange,
  boardId,
  boardName,
  onInvited,
}: WhiteboardInviteDialogProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchUser[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [invitingEmail, setInvitingEmail] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setError(null);
      return;
    }
  }, [open]);

  React.useEffect(() => {
    if (!open || query.trim().length < 2) {
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

        if (!response.ok) {
          throw new Error(payload.error ?? "Search failed");
        }

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
  }, [open, query]);

  async function inviteUser(email: string) {
    setInvitingEmail(email);
    setError(null);

    try {
      const response = await fetch(`/api/whiteboards/${boardId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to send invite");
      }

      toast.success(`Invitation sent to ${email}`);
      onInvited?.();
      onOpenChange(false);
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Unable to send invite");
    } finally {
      setInvitingEmail(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite collaborator</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Search registered users by name or email to invite them to &quot;{boardName}&quot;.
        </p>

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

        <ScrollArea className="max-h-56 rounded-lg border border-border">
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

            {!searching && query.trim().length < 2 && (
              <p className="px-2 py-3 text-xs text-muted-foreground">Type at least 2 characters to search.</p>
            )}

            {results.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
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

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
