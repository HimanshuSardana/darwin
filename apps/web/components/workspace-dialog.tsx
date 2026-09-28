"use client";

import { ContainerIcon, LaptopIcon } from "lucide-react";
import { useState } from "react";
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
import { cn } from "@/lib/utils";

export type WorkspaceProvider = "microvm" | "host";

const PROVIDERS: {
  readonly id: WorkspaceProvider;
  readonly title: string;
  readonly description: string;
  readonly icon: typeof ContainerIcon;
}[] = [
  {
    id: "microvm",
    title: "MicroVM",
    description: "Isolated VM with a persistent disk. Slower first boot.",
    icon: ContainerIcon,
  },
  {
    id: "host",
    title: "Host directory",
    description: "Plain folder on this machine. Fast, approval-gated writes.",
    icon: LaptopIcon,
  },
];

/** Spin-up dialog: name + provider for a new persistent workspace. */
export function WorkspaceDialog({
  error,
  onOpenChange,
  onSubmit,
  open,
  pending,
}: {
  readonly error?: string | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (input: { name: string; provider: WorkspaceProvider }) => void;
  readonly open: boolean;
  readonly pending: boolean;
}) {
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<WorkspaceProvider>("microvm");

  const submit = () => {
    if (!name.trim() || pending) return;
    onSubmit({ name: name.trim().slice(0, 60), provider });
    setName("");
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Spin up workspace</DialogTitle>
          <DialogDescription>
            A named, persistent place for the agent to work. Revisit it anytime
            from the sidebar.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Input
            aria-label="Workspace name"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
            placeholder="e.g. blog-rewrite"
            value={name}
          />
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Provider">
            {PROVIDERS.map((option) => {
              const Icon = option.icon;
              const selected = provider === option.id;
              return (
                <button
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors outline-none",
                    "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                    selected
                      ? "border-ring bg-accent/60"
                      : "hover:bg-accent/40",
                  )}
                  key={option.id}
                  onClick={() => setProvider(option.id)}
                  role="radio"
                  aria-checked={selected}
                  type="button"
                >
                  <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <span>
                    <span className="block text-sm font-medium">{option.title}</span>
                    <span className="text-muted-foreground block text-xs">
                      {option.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <DialogFooter>
          <div className="flex w-full flex-col gap-2">
            {error ? <p className="text-destructive text-xs">{error}</p> : null}
            <div className="flex justify-end">
              <Button disabled={!name.trim() || pending} onClick={submit} type="button">
                {pending ? "Spinning up…" : "Spin up"}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
