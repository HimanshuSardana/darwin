import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

declare global {
  // eslint-disable-next-line no-var
  var __darwinSessionsDb: Database.Database | undefined;
}

/** One-time import from the pre-SQLite JSON store. */
function migrateLegacyStore(dir: string, sqlite: Database.Database): void {
  try {
    const legacyPath = join(dir, "sessions.json");
    if (!existsSync(legacyPath)) return;
    const parsed: unknown = JSON.parse(readFileSync(legacyPath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
    const insert = sqlite.prepare(
      "INSERT OR IGNORE INTO session_owners (sessionId, userId, createdAt) VALUES (?, ?, ?)",
    );
    for (const [sessionId, entry] of Object.entries(parsed as Record<string, unknown>)) {
      if (!validSessionId(sessionId)) continue;
      const record = entry as { userId?: unknown; createdAt?: unknown } | null;
      if (!record || typeof record.userId !== "string") continue;
      insert.run(
        sessionId,
        record.userId,
        typeof record.createdAt === "number" ? record.createdAt : Date.now(),
      );
    }
    renameSync(legacyPath, `${legacyPath}.migrated`);
  } catch {
    // Best effort; JSON store stays untouched on failure.
  }
}

/** Session IDs are opaque Eve handles; reject anything else outright. */
const SESSION_ID_RE = /^[A-Za-z0-9_-]{8,128}$/;
const RESERVED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function db(): Database.Database {
  if (!globalThis.__darwinSessionsDb) {
    const dir = process.env.DARWIN_DATA_DIR ?? join(homedir(), ".darwin");
    mkdirSync(dir, { recursive: true });
    const sqlite = new Database(join(dir, "darwin.db"));
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("busy_timeout = 5000");
    sqlite.exec(
      "CREATE TABLE IF NOT EXISTS session_owners (" +
        "sessionId TEXT PRIMARY KEY, " +
        "userId TEXT NOT NULL, " +
        "createdAt INTEGER NOT NULL)",
    );
    globalThis.__darwinSessionsDb = sqlite;
    migrateLegacyStore(dir, sqlite);
  }
  return globalThis.__darwinSessionsDb;
}

function validSessionId(value: unknown): value is string {
  return typeof value === "string" && SESSION_ID_RE.test(value) && !RESERVED_KEYS.has(value);
}

/**
 * First writer wins, atomically: INSERT OR IGNORE means concurrent claims
 * for a fresh ID resolve to exactly one owner. Returns the owner id.
 */
export function claimSession(sessionId: string, userId: string): string {
  if (!validSessionId(sessionId)) throw new Error("invalid session id");
  const row = db()
    .prepare("SELECT userId FROM session_owners WHERE sessionId = ?")
    .get(sessionId) as { userId: string } | undefined;
  if (row) return row.userId;
  db()
    .prepare(
      "INSERT OR IGNORE INTO session_owners (sessionId, userId, createdAt) VALUES (?, ?, ?)",
    )
    .run(sessionId, userId, Date.now());
  return (
    (db().prepare("SELECT userId FROM session_owners WHERE sessionId = ?").get(sessionId) as
      | { userId: string }
      | undefined)?.userId ?? userId
  );
}

export function sessionOwner(sessionId: string): string | null {
  if (!validSessionId(sessionId)) return null;
  const row = db()
    .prepare("SELECT userId FROM session_owners WHERE sessionId = ?")
    .get(sessionId) as { userId: string } | undefined;
  return row?.userId ?? null;
}

export function ownedSessions(userId: string): { sessionId: string; createdAt: number }[] {
  return db()
    .prepare("SELECT sessionId, createdAt FROM session_owners WHERE userId = ?")
    .all(userId) as { sessionId: string; createdAt: number }[];
}
