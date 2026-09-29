"use client";

import { ContainerIcon, LaptopIcon } from "lucide-react";
import { CheckIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
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
import { PACKAGE_CATALOG } from "@/lib/packages";
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
  readonly onSubmit: (input: {
    name: string;
    provider: WorkspaceProvider;
    packages: string[];
  }) => void;
  readonly open: boolean;
  readonly pending: boolean;
}) {
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<WorkspaceProvider>("microvm");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<readonly string[]>([]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return PACKAGE_CATALOG;
    return PACKAGE_CATALOG.filter(
      (entry) =>
        entry.label.toLowerCase().includes(needle) ||
        entry.description.toLowerCase().includes(needle),
    );
  }, [query]);

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id],
    );
  };

  const submit = () => {
    if (!name.trim() || pending) return;
    onSubmit({
      name: name.trim().slice(0, 60),
      provider,
      packages: provider === "microvm" ? [...selected] : [],
    });
    setName("");
    setQuery("");
    setSelected([]);
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
          {provider === "microvm" ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-medium">
                  Packages
                  {selected.length > 0 ? (
                    <span className="text-muted-foreground font-normal">
                      {` · ${selected.length} selected`}
                    </span>
                  ) : null}
                </p>
                {selected.length > 0 ? (
                  <button
                    className="text-muted-foreground hover:text-foreground text-xs"
                    onClick={() => setSelected([])}
                    type="button"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <div className="relative">
                <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                <Input
                  aria-label="Search packages"
                  className="pl-8"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search typst, ffmpeg…"
                  value={query}
                />
              </div>
              <div
                className="border-border max-h-44 overflow-y-auto rounded-lg border"
                role="group"
                aria-label="Packages to install"
              >
                {matches.length === 0 ? (
                  <p className="text-muted-foreground px-3 py-4 text-center text-xs">
                    No packages match “{query.trim()}”.
                  </p>
                ) : (
                  matches.map((entry) => {
                    const checked = selected.includes(entry.id);
                    return (
                      <button
                        aria-pressed={checked}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors outline-none",
                          "focus-visible:bg-accent",
                          checked ? "bg-accent/60" : "hover:bg-accent/40",
                        )}
                        key={entry.id}
                        onClick={() => toggle(entry.id)}
                        type="button"
                      >
                        <span
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded border",
                            checked
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border text-transparent",
                          )}
                        >
                          <CheckIcon className="size-3" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">
                            {entry.label}
                          </span>
                          <span className="text-muted-foreground block truncate text-xs">
                            {entry.description}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                Installed into the VM on first use. Nothing is baked into the image.
              </p>
            </div>
          ) : null}
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
