import { betterAuth } from "better-auth";
import Database from "better-sqlite3";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

declare global {
  // eslint-disable-next-line no-var
  var __darwinAuthDb: Database.Database | undefined;
  // eslint-disable-next-line no-var
  var __darwinAuth: Auth | undefined;
}

function dataDir(): string {
  const dir = process.env.DARWIN_DATA_DIR ?? join(homedir(), ".darwin");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function database(): Database.Database {
  if (!globalThis.__darwinAuthDb) {
    if (!process.env.BETTER_AUTH_SECRET) {
      throw new Error("BETTER_AUTH_SECRET is required (see apps/web/.env.local).");
    }
    const path = join(dataDir(), "darwin.db");
    const fresh = !existsSync(path);
    const sqlite = new Database(path);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("busy_timeout = 5000");
    // Password hashes and sessions live here: owner-only permissions.
    if (fresh) chmodSync(path, 0o600);
    globalThis.__darwinAuthDb = sqlite;
  }
  return globalThis.__darwinAuthDb;
}

function buildAuth() {
  return betterAuth({
    database: database(),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
    },
  });
}

type Auth = ReturnType<typeof buildAuth>;

export const auth: Auth =
  globalThis.__darwinAuth ?? (globalThis.__darwinAuth = buildAuth());
