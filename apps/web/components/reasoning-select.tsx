"use client";

import { BrainIcon, ChevronDownIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  REASONING_DESCRIPTIONS,
  REASONING_EFFORTS,
  REASONING_LABELS,
  type ReasoningEffort,
} from "@/lib/reasoning";
import { cn } from "@/lib/utils";

/**
 * Reasoning effort picker with the same UX as the AI Elements model
 * selector (compact trigger + checkable option list).
 *
 * Built on DropdownMenu rather than Select: option rows carry two-line
 * content (name + description) and Select would either mirror all of it
 * into the trigger (SelectValue) or fight the surrounding composer form
 * for click handling. Menu items are non-interactive divs, so there is no
 * form-submit hazard at all.
 */
export function ReasoningSelect({
  onChange,
  value,
}: {
  readonly onChange: (effort: ReasoningEffort) => void;
  readonly value: ReasoningEffort;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Reasoning effort"
          className={cn(
            "flex h-8 w-fit items-center gap-1.5 rounded-md px-2 text-xs font-medium",
            "text-muted-foreground shadow-none transition-colors outline-none",
            "hover:bg-accent hover:text-foreground",
            "data-[state=open]:bg-accent data-[state=open]:text-foreground",
            "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          )}
          title="Reasoning effort for this turn"
          type="button"
        >
          <BrainIcon className="size-3.5" />
          <span className="font-normal">{REASONING_LABELS[value]}</span>
          <ChevronDownIcon className="size-3.5 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top">
        <DropdownMenuRadioGroup
          onValueChange={(next) => onChange(next as ReasoningEffort)}
          value={value}
        >
          {REASONING_EFFORTS.map((effort) => (
            <DropdownMenuRadioItem key={effort} value={effort}>
              <span className="flex flex-col items-start gap-0.5 py-0.5">
                <span className="text-xs">{REASONING_LABELS[effort]}</span>
                <span className="text-muted-foreground text-[11px]">
                  {REASONING_DESCRIPTIONS[effort]}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
