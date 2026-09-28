"use client";

import { HammerIcon, ListChecksIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MODE_DESCRIPTIONS, MODE_LABELS, MODES, type Mode } from "@/lib/mode";
import { cn } from "@/lib/utils";

const MODE_ICONS: Record<Mode, typeof HammerIcon> = {
  plan: ListChecksIcon,
  build: HammerIcon,
};

/** Plan / Build segmented toggle for the composer toolbar. */
export function ModeSelect({
  onChange,
  value,
}: {
  readonly onChange: (mode: Mode) => void;
  readonly value: Mode;
}) {
  return (
    <div
      aria-label="Agent mode"
      className="flex h-8 items-center gap-0.5 rounded-md border border-transparent p-0.5"
      role="group"
    >
      {MODES.map((mode) => {
        const Icon = MODE_ICONS[mode];
        const active = mode === value;
        return (
          <Tooltip key={mode}>
            <TooltipTrigger asChild>
              <button
                aria-pressed={active}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded px-2 text-xs transition-colors outline-none",
                  "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                  active
                    ? "bg-accent text-foreground font-medium shadow-xs"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  mode === "plan" && active && "text-sky-600 dark:text-sky-400",
                  mode === "build" && active && "text-amber-600 dark:text-amber-400",
                )}
                onClick={() => onChange(mode)}
                title={MODE_DESCRIPTIONS[mode]}
                type="button"
              >
                <Icon className="size-3.5" />
                {MODE_LABELS[mode]}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{MODE_DESCRIPTIONS[mode]}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
