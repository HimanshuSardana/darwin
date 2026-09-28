"use client";

/** Named persistent workspace: an isolated microVM disk or a host directory. */
export interface WorkspaceRecord {
  readonly id: string;
  readonly name: string;
  readonly provider: "microvm" | "host";
  /** Bound Eve session for microvm workspaces (owns the persistent sandbox). */
  readonly sessionId: string | null;
  /** Host directory for host workspaces. */
  readonly path: string | null;
  readonly createdAt: number;
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

export function listWorkspaces(): Promise<{ workspaces: WorkspaceRecord[] }> {
  return request("/api/workspaces");
}

export function createWorkspace(input: {
  name: string;
  provider: "microvm" | "host";
  sessionId?: string;
}): Promise<{ workspace: WorkspaceRecord }> {
  return request("/api/workspaces", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteWorkspace(id: string): Promise<{ ok: true }> {
  return request(`/api/workspaces/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Create a fresh Eve session (used when spinning up a microvm workspace). */
export async function createEveSession(): Promise<string> {
  const response = await request<{ sessionId: string }>("/eve/v1/session", {
    method: "POST",
    body: JSON.stringify({}),
  });
  return response.sessionId;
}

/**
 * Ephemeral turn context for the selected named workspace.
 * Undefined when none is selected (default behavior).
 */
export function namedWorkspaceClientContext(
  workspace: WorkspaceRecord | null,
): string | undefined {
  if (!workspace) return undefined;
  if (workspace.provider === "host" && workspace.path) {
    return (
      `Active workspace "${workspace.name}" at ${workspace.path}. ` +
      `RULE: start EVERY local_read/local_write path with "${workspace.path}/" ` +
      `(e.g. "${workspace.path}/notes.txt", never bare "notes.txt"). ` +
      `RULE: run EVERY local_bash command from inside it (prefix commands with ` +
      `\`cd "${workspace.path}" && \` or use absolute paths under it). ` +
      `Do not touch files anywhere else on the host.`
    );
  }
  return (
    `Active workspace "${workspace.name}": a persistent microVM whose /workspace ` +
    `disk survives across sessions. Keep all project files there so work persists.`
  );
}
