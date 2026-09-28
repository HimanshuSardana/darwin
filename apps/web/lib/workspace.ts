"use client";

/**
 * Workspace picker for the composer: where should the agent's tools run?
 *
 * - `vm`: sandboxed microVM tools (bash, read_file, write_file). Default, safest.
 * - `local`: host-machine tools (local_bash, local_read, local_write) rooted
 *   at DARWIN_WORKSPACE. Every write/exec pauses for user approval.
 *
 * Eve has no per-turn workspace client option, so the choice rides along as
 * ephemeral `clientContext` (never persisted to durable history). `vm` sends
 * an explicit guard too, so the model never reaches for local_* by accident.
 */
export const WORKSPACES = ["vm", "local"] as const;

export type Workspace = (typeof WORKSPACES)[number];

export const WORKSPACE_LABELS: Record<Workspace, string> = {
  vm: "Virtual machine",
  local: "This machine",
};

export const WORKSPACE_DESCRIPTIONS: Record<Workspace, string> = {
  vm: "Isolated microVM — tools cannot touch the host",
  local: "Runs on the host — writes and exec need approval",
};

const STORAGE_KEY = "darwin.workspace.v1";

export function loadWorkspace(): Workspace {
  if (typeof window === "undefined") return "vm";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === "local" ? "local" : "vm";
}

export function saveWorkspace(workspace: Workspace): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, workspace);
  } catch {
    // Non-fatal.
  }
}

/** Ephemeral turn context carrying the workspace choice. */
export function workspaceClientContext(workspace: Workspace): string {
  if (workspace === "local") {
    return (
      "Workspace: this machine. Do ALL file and shell work with local_bash, " +
      "local_read, and local_write (host workspace root); avoid the sandboxed " +
      "VM tools since they see a different filesystem. Every local_bash and " +
      "local_write call pauses for user approval — batch independent reads together."
    );
  }
  return (
    "Workspace: virtual machine. Use ONLY the sandboxed tools (bash, read_file, " +
    "write_file, glob, grep); they run in an isolated microVM. NEVER call " +
    "local_bash, local_read, or local_write in this mode."
  );
}
