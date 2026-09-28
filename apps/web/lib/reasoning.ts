"use client";

/**
 * Reasoning effort selector for the composer.
 *
 * Eve applies `reasoning` as agent-level config, not a per-turn client
 * option, so the selected effort rides along as ephemeral `clientContext`
 * (a user-role context message for this turn only — never persisted to
 * durable history). `provider-default` sends nothing.
 */
export const REASONING_EFFORTS = [
  "provider-default",
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
] as const;

export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export const REASONING_LABELS: Record<ReasoningEffort, string> = {
  "provider-default": "Default",
  none: "None",
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Max",
};

export const REASONING_DESCRIPTIONS: Record<ReasoningEffort, string> = {
  "provider-default": "Use the agent's configured reasoning effort",
  none: "Answer directly, no visible reasoning",
  minimal: "Light reasoning for simple tasks",
  low: "Quick reasoning pass",
  medium: "Balanced reasoning",
  high: "Deep reasoning for hard problems",
  xhigh: "Maximum reasoning effort",
};

const STORAGE_KEY = "darwin.reasoning-effort.v1";

export function loadReasoningEffort(): ReasoningEffort {
  if (typeof window === "undefined") return "provider-default";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return (REASONING_EFFORTS as readonly string[]).includes(raw ?? "")
    ? (raw as ReasoningEffort)
    : "provider-default";
}

export function saveReasoningEffort(effort: ReasoningEffort): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, effort);
  } catch {
    // Non-fatal.
  }
}

/** Ephemeral turn context carrying the selected effort; undefined = send nothing. */
export function reasoningClientContext(effort: ReasoningEffort): string | undefined {
  if (effort === "provider-default") return undefined;
  if (effort === "none") {
    return "Reasoning effort for this turn: none. Answer directly and concisely without extended deliberation.";
  }
  return `Reasoning effort for this turn: ${effort}. Calibrate how deeply you reason before answering (minimal < low < medium < high < xhigh).`;
}
