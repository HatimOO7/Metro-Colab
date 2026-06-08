"use client";

import { Loader2, Sparkles } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DiagramPayload } from "@/lib/excalidraw-diagram";

type AiDiagramDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated: (diagram: DiagramPayload) => void;
};

export function AiDiagramDialog({ open, onOpenChange, onGenerated }: AiDiagramDialogProps) {
  const [prompt, setPrompt] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleGenerate() {
    if (!prompt.trim()) {
      setError("Describe the diagram you want to generate.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/diagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Generation failed");
      }

      onGenerated(payload.diagram as DiagramPayload);
      onOpenChange(false);
      setPrompt("");
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-fuchsia-600" aria-hidden="true" />
            AI Diagram
          </DialogTitle>
          <DialogDescription>
            Describe a flowchart, mind map, or brainstorm. Gemini will generate shapes and inject them onto the canvas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="diagram-prompt">Prompt</Label>
            <Input
              id="diagram-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="User onboarding flow with signup, verification, and welcome"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !loading) {
                  void handleGenerate();
                }
              }}
            />
          </div>

          {error && (
            <p className="rounded-lg border border-destructive/25 bg-red-50 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleGenerate()} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
                Generate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
