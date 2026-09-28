import { betterAuth } from "better-auth";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function dataDir(): string {
  const dir = process.env.DARWIN_DATA_DIR ?? join(homedir(), ".darwin");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function database() {
  const sqlite = new Database(join(dataDir(), "darwin.db"));
  sqlite.pragma("journal_mode = WAL");
  return sqlite;
}

export const auth = betterAuth({
  database: database(),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
  },
});
