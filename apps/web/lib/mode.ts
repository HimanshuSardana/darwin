"use client";

/**
 * Plan / Build mode for the composer.
 *
 * - `plan`: read-only exploration. The model may only use read tools
 *   (glob, grep, read_file, local_read) plus update_plan, and must publish
 *   findings as todos. Side-effecting tools are forbidden by instruction;
 *   host write/exec tools additionally park for user approval, and VM
 *   writes are sandbox-contained, so stray calls have no blast radius.
 * - `build`: every tool is allowed; the model works through plans and
 *   keeps todo statuses current.
 *
 * The mode rides as ephemeral `clientContext` (never persisted).
 */
export const MODES = ["plan", "build"] as const;

export type Mode = (typeof MODES)[number];

export const MODE_LABELS: Record<Mode, string> = {
  plan: "Plan",
  build: "Build",
};

export const MODE_DESCRIPTIONS: Record<Mode, string> = {
  plan: "Read-only — explore and produce a todo plan",
  build: "Full access — execute the plan",
};

const STORAGE_KEY = "darwin.mode.v1";

export function loadMode(): Mode {
  if (typeof window === "undefined") return "build";
  return window.localStorage.getItem(STORAGE_KEY) === "plan" ? "plan" : "build";
}

export function saveMode(mode: Mode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Non-fatal.
  }
}

/** Ephemeral turn context carrying the active mode. */
export function modeClientContext(mode: Mode): string {
  if (mode === "plan") {
    return (
      "Mode: plan (READ-ONLY). Use ONLY read tools (glob, grep, read_file, " +
      "local_read) plus update_plan. NEVER call bash, write_file, local_bash, " +
      "local_write, or any other side-effecting tool. Explore the codebase, " +
      "then publish the complete plan via update_plan (todos with id, title, " +
      "status; exactly one in_progress at most). Do not implement anything."
    );
  }
  return (
    "Mode: build. All tools are allowed. If a plan exists earlier in this " +
    "conversation, work through its todos in order and call update_plan to " +
    "mark each in_progress/completed as you go."
  );
}
