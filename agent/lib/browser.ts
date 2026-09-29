import { execFile } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Host-side agent-browser runner. The browser (system Chromium) runs on the
 * host — not in the VM sandbox — so its window/screenshots are visible here.
 */

const MAX_OUTPUT_BYTES = 12_000;
const MAX_SHOTS_KEPT = 30;

export function shotsDir(): string {
  const dir = join(process.env.DARWIN_DATA_DIR ?? join(homedir(), ".darwin"), "browser-shots");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function binary(): string {
  if (process.env.AGENT_BROWSER_BIN) return process.env.AGENT_BROWSER_BIN;
  const local = join(process.cwd(), "node_modules", ".bin", "agent-browser");
  try {
    statSync(local);
    return local;
  } catch {
    return "agent-browser";
  }
}

function truncate(text: string): { text: string; truncated: boolean } {
  const bytes = Buffer.byteLength(text);
  if (bytes <= MAX_OUTPUT_BYTES) return { text, truncated: false };
  return {
    text: text.slice(0, MAX_OUTPUT_BYTES) + `\n…[truncated ${bytes - MAX_OUTPUT_BYTES} bytes]`,
    truncated: true,
  };
}

export interface BrowserResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  truncated: boolean;
}

export function runBrowser(
  args: string[],
  timeoutMs = 60_000,
  env?: Record<string, string>,
): Promise<BrowserResult> {
  return new Promise((resolvePromise) => {
    execFile(
      binary(),
      args,
      {
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, AGENT_BROWSER_STREAM_PORT: "9223", ...env },
      }, (error, stdout, stderr) => {
      const out = truncate(String(stdout ?? ""));
      const err = truncate(String(stderr ?? ""));
      resolvePromise({
        stdout: out.text,
        stderr: err.text,
        exitCode: (error as { code?: unknown } | null)?.code === 0 || !error ? 0 : 1,
        truncated: out.truncated || err.truncated,
      });
    },
    );
  });
}

/** Screenshot path for a fresh capture (timestamped). Prunes old shots. */
export function nextShotPath(): string {
  const dir = shotsDir();
  try {
    const shots = readdirSync(dir)
      .filter((file) => file.endsWith(".png"))
      .map((file) => ({ file, mtime: statSync(join(dir, file)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    for (const stale of shots.slice(MAX_SHOTS_KEPT)) {
      try {
        rmSync(join(dir, stale.file));
      } catch {
        // Best effort.
      }
    }
  } catch {
    // Best effort.
  }
  return join(dir, `shot-${Date.now()}.png`);
}

/** Newest screenshot, if any. */
export function latestShot(): string | null {
  try {
    const shots = readdirSync(shotsDir())
      .filter((file) => file.endsWith(".png"))
      .map((file) => ({ file, mtime: statSync(join(shotsDir(), file)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    return shots.length > 0 ? shots[0].file : null;
  } catch {
    return null;
  }
}
