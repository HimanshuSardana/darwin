"use client";

import { ContainerIcon, FolderPlusIcon, LaptopIcon, LayersIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { WorkspaceRecord } from "@/lib/workspaces";
import { cn } from "@/lib/utils";

/**
 * Named-workspace picker for the composer. Lists the workspaces the user
 * created in the sidebar; picking one pairs the execution target and scopes
 * the turn to it. Clearing returns to the default VM behavior.
 */
export function WorkspacePicker({
  onChange,
  onNew,
  value,
  workspaces,
}: {
  readonly onChange: (workspace: WorkspaceRecord | null) => void;
  readonly onNew: () => void;
  readonly value: WorkspaceRecord | null;
  readonly workspaces: readonly WorkspaceRecord[];
}) {
  const Icon = !value ? LayersIcon : value.provider === "host" ? LaptopIcon : ContainerIcon;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Active workspace"
          className={cn(
            "flex h-8 w-fit items-center gap-1.5 rounded-md px-2 text-xs font-medium",
            "text-muted-foreground shadow-none transition-colors outline-none",
            "hover:bg-accent hover:text-foreground",
            "data-[state=open]:bg-accent data-[state=open]:text-foreground",
            "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            value && "text-sky-600 dark:text-sky-400",
          )}
          title="Active workspace"
          type="button"
        >
          <Icon className="size-3.5" />
          <span className="max-w-28 truncate font-normal">
            {value ? value.name : "Workspace"}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top">
        <DropdownMenuRadioGroup
          onValueChange={(next) => {
            if (next === "") {
              onChange(null);
              return;
            }
            const found = workspaces.find((entry) => entry.id === next);
            if (found) onChange(found);
          }}
          value={value?.id ?? ""}
        >
          <DropdownMenuRadioItem value="">
            <span className="flex flex-col items-start gap-0.5 py-0.5">
              <span className="text-xs">No workspace</span>
              <span className="text-muted-foreground text-[11px]">
                Default VM behavior
              </span>
            </span>
          </DropdownMenuRadioItem>
          {workspaces.map((workspace) => {
            const OptionIcon = workspace.provider === "host" ? LaptopIcon : ContainerIcon;
            return (
              <DropdownMenuRadioItem key={workspace.id} value={workspace.id}>
                <span className="flex items-start gap-2 py-0.5">
                  <OptionIcon className="mt-0.5 size-3.5 shrink-0" />
                  <span className="flex flex-col items-start gap-0.5">
                    <span className="text-xs">{workspace.name}</span>
                    <span className="text-muted-foreground text-[11px]">
                      {workspace.provider === "host" ? "Host directory" : "MicroVM"}
                    </span>
                  </span>
                </span>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <button
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs outline-none hover:bg-accent focus-visible:bg-accent"
          onClick={onNew}
          type="button"
        >
          <FolderPlusIcon className="size-3.5" />
          New workspace…
        </button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
