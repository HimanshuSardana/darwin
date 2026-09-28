"use client";

import { BrainIcon } from "lucide-react";
import {
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
} from "@/components/ai-elements/prompt-input";
import {
  REASONING_DESCRIPTIONS,
  REASONING_EFFORTS,
  REASONING_LABELS,
  type ReasoningEffort,
} from "@/lib/reasoning";

/**
 * Reasoning effort picker modeled on the AI Elements model selector
 * (PromptInputSelect + Trigger + Content + Item), with a compact trigger
 * label — SelectValue would mirror the selected item's full content,
 * including its description.
 */
export function ReasoningSelect({
  onChange,
  value,
}: {
  readonly onChange: (effort: ReasoningEffort) => void;
  readonly value: ReasoningEffort;
}) {
  return (
    <PromptInputSelect
      onValueChange={(next) => onChange(next as ReasoningEffort)}
      value={value}
    >
      {/* No Tooltip wrapper here: it competes with Radix Select for pointer
          events on the trigger. `title` gives the hover text instead. */}
      <PromptInputSelectTrigger
        aria-label="Reasoning effort"
        className="h-8 gap-1.5 px-2 text-xs"
        title="Reasoning effort for this turn"
        type="button"
      >
        <BrainIcon className="size-3.5" />
        <span className="font-normal">{REASONING_LABELS[value]}</span>
      </PromptInputSelectTrigger>
      <PromptInputSelectContent align="start">
        {REASONING_EFFORTS.map((effort) => (
          <PromptInputSelectItem key={effort} value={effort}>
            <span className="flex flex-col items-start gap-0.5">
              <span className="text-xs">{REASONING_LABELS[effort]}</span>
              <span className="text-muted-foreground text-[11px]">
                {REASONING_DESCRIPTIONS[effort]}
              </span>
            </span>
          </PromptInputSelectItem>
        ))}
      </PromptInputSelectContent>
    </PromptInputSelect>
  );
}
