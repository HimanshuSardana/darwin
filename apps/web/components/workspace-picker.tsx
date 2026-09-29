"use client";

import { CheckIcon, ContainerIcon, FolderPlusIcon, LaptopIcon, LayersIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { WorkspaceRecord } from "@/lib/workspaces";
import { cn } from "@/lib/utils";

/** Menu row with a right-side tick instead of the radio dot. */
function WorkspacePickerItem({
  description,
  icon,
  onSelect,
  selected,
  title,
}: {
  readonly description: string;
  readonly icon?: ReactNode;
  readonly onSelect: () => void;
  readonly selected: boolean;
  readonly title: string;
}) {
  return (
    <DropdownMenuItem onSelect={onSelect}>
      <span className="flex min-w-0 flex-1 items-start gap-2 py-0.5">
        {icon}
        <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
          <span className="text-xs">{title}</span>
          <span className="text-muted-foreground text-[11px]">{description}</span>
        </span>
      </span>
      {selected ? <CheckIcon className="size-4 shrink-0" /> : null}
    </DropdownMenuItem>
  );
}

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
        <WorkspacePickerItem
          description="Default VM behavior"
          onSelect={() => onChange(null)}
          selected={value === null}
          title="No workspace"
        />
        {workspaces.map((workspace) => {
          const OptionIcon = workspace.provider === "host" ? LaptopIcon : ContainerIcon;
          return (
            <WorkspacePickerItem
              key={workspace.id}
              description={workspace.provider === "host" ? "Host directory" : "MicroVM"}
              icon={<OptionIcon className="mt-0.5 size-3.5 shrink-0" />}
              onSelect={() => onChange(workspace)}
              selected={value?.id === workspace.id}
              title={workspace.name}
            />
          );
        })}
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
