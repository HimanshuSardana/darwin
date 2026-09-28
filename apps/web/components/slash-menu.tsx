"use client";

import { TerminalIcon } from "lucide-react";
import type { SlashCommand } from "@/lib/slash-commands";
import { cn } from "@/lib/utils";

/** Autocomplete popup for "/" commands in the composer. */
export function SlashMenu({
  commands,
  onPick,
  selectedIndex,
}: {
  readonly commands: readonly SlashCommand[];
  readonly onPick: (command: SlashCommand) => void;
  readonly selectedIndex: number;
}) {
  if (commands.length === 0) return null;
  return (
    <div className="absolute right-0 bottom-full left-0 z-30 mb-2 overflow-hidden rounded-lg border bg-popover shadow-lg">
      <ul className="max-h-56 overflow-y-auto p-1">
        {commands.map((command, index) => (
          <li key={command.name}>
            <button
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
                index === selectedIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/60",
              )}
              onClick={() => onPick(command)}
              onMouseDown={(event) => event.preventDefault()}
              type="button"
            >
              <TerminalIcon className="text-muted-foreground size-4 shrink-0" />
              <span className="min-w-0">
                <span className="block font-mono text-sm">/{command.name}</span>
                <span className="text-muted-foreground block truncate text-xs">
                  {command.description}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
