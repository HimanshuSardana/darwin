import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export interface SessionOwnership {
  readonly userId: string;
  readonly createdAt: number;
}

type Registry = Record<string, SessionOwnership>;

function storePath(): string {
  const dir = process.env.DARWIN_DATA_DIR ?? join(homedir(), ".darwin");
  return join(dir, "sessions.json");
}

async function load(): Promise<Registry> {
  try {
    const raw = await readFile(storePath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Registry;
    }
    return {};
  } catch {
    return {};
  }
}

async function save(registry: Registry): Promise<void> {
  const path = storePath();
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, JSON.stringify(registry, null, 2), "utf8");
}

/** Session IDs are opaque Eve handles; reject anything else outright. */
function validSessionId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(value);
}

/** First writer wins: whoever registers a session first owns it. */
export async function claimSession(sessionId: string, userId: string): Promise<string> {
  if (!validSessionId(sessionId)) throw new Error("invalid session id");
  const registry = await load();
  const existing = registry[sessionId];
  if (existing) return existing.userId;
  registry[sessionId] = { userId, createdAt: Date.now() };
  await save(registry);
  return userId;
}

export async function sessionOwner(sessionId: string): Promise<string | null> {
  const registry = await load();
  return registry[sessionId]?.userId ?? null;
}

export async function ownedSessions(userId: string): Promise<
  { sessionId: string; createdAt: number }[]
> {
  const registry = await load();
  return Object.entries(registry)
    .filter(([, entry]) => entry.userId === userId)
    .map(([sessionId, entry]) => ({ sessionId, createdAt: entry.createdAt }));
}
