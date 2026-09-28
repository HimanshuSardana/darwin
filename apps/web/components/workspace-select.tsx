"use client";

import { ContainerIcon, LaptopIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  WORKSPACE_DESCRIPTIONS,
  WORKSPACE_LABELS,
  WORKSPACES,
  type Workspace,
} from "@/lib/workspace";
import { cn } from "@/lib/utils";

const WORKSPACE_ICONS: Record<Workspace, typeof ContainerIcon> = {
  vm: ContainerIcon,
  local: LaptopIcon,
};

/** Where the agent's tools run: isolated VM or the host machine. */
export function WorkspaceSelect({
  onChange,
  value,
}: {
  readonly onChange: (workspace: Workspace) => void;
  readonly value: Workspace;
}) {
  const Icon = WORKSPACE_ICONS[value];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Workspace: where tools run"
          className={cn(
            "flex h-8 w-fit items-center gap-1.5 rounded-md px-2 text-xs font-medium",
            "text-muted-foreground shadow-none transition-colors outline-none",
            "hover:bg-accent hover:text-foreground",
            "data-[state=open]:bg-accent data-[state=open]:text-foreground",
            "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            value === "local" && "text-amber-600 dark:text-amber-400",
          )}
          title="Workspace: where the agent's tools run"
          type="button"
        >
          <Icon className="size-3.5" />
          <span className="font-normal">{WORKSPACE_LABELS[value]}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top">
        <DropdownMenuRadioGroup
          onValueChange={(next) => onChange(next as Workspace)}
          value={value}
        >
          {WORKSPACES.map((workspace) => {
            const OptionIcon = WORKSPACE_ICONS[workspace];
            return (
              <DropdownMenuRadioItem key={workspace} value={workspace}>
                <span className="flex items-start gap-2 py-0.5">
                  <OptionIcon className="mt-0.5 size-3.5 shrink-0" />
                  <span className="flex flex-col items-start gap-0.5">
                    <span className="text-xs">{WORKSPACE_LABELS[workspace]}</span>
                    <span className="text-muted-foreground text-[11px]">
                      {WORKSPACE_DESCRIPTIONS[workspace]}
                    </span>
                  </span>
                </span>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
