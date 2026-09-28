"use client";

import { BrainIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  REASONING_DESCRIPTIONS,
  REASONING_EFFORTS,
  REASONING_LABELS,
  type ReasoningEffort,
} from "@/lib/reasoning";

export function ReasoningSelect({
  onChange,
  value,
}: {
  readonly onChange: (effort: ReasoningEffort) => void;
  readonly value: ReasoningEffort;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Select
          onValueChange={(next) => onChange(next as ReasoningEffort)}
          value={value}
        >
          <SelectTrigger
            aria-label="Reasoning effort"
            className="h-8 w-auto gap-1.5 border-transparent bg-transparent px-2 text-muted-foreground text-xs shadow-none hover:bg-muted hover:text-foreground"
          >
            <BrainIcon className="size-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            {REASONING_EFFORTS.map((effort) => (
              <SelectItem key={effort} value={effort}>
                <span className="flex flex-col items-start gap-0.5">
                  <span className="text-xs">{REASONING_LABELS[effort]}</span>
                  <span className="text-muted-foreground text-[11px]">
                    {REASONING_DESCRIPTIONS[effort]}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TooltipTrigger>
      <TooltipContent side="top">Reasoning effort for this turn</TooltipContent>
    </Tooltip>
  );
}
