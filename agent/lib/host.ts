import { execFile } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";

/**
 * Host-machine helpers for the `local_*` tools. Everything is confined to
 * a single workspace root so the model cannot wander the host filesystem.
 */

const MAX_OUTPUT_BYTES = 30_000;
const MAX_READ_BYTES = 256_000;
const MAX_WRITE_BYTES = 1_000_000;

/** Workspace root on the host. Override with DARWIN_WORKSPACE. */
export function hostRoot(): string {
  return process.env.DARWIN_WORKSPACE ?? process.cwd();
}

/** Resolve a tool-supplied path, rejecting escapes outside the root. */
export function resolveInRoot(inputPath: string): string {
  const absolute = resolve(hostRoot(), inputPath);
  const rel = relative(hostRoot(), absolute);
  if (rel === ".." || rel.startsWith(`..${sep}`)) {
    throw new Error(`Path escapes the host workspace root: ${inputPath}`);
  }
  return absolute;
}

function truncateTail(text: string, maxBytes: number): { text: string; truncated: boolean } {
  const bytes = Buffer.byteLength(text);
  if (bytes <= maxBytes) return { text, truncated: false };
  const buf = Buffer.from(text);
  return {
    text: `…[truncated ${bytes - maxBytes} bytes]\n${buf.subarray(bytes - maxBytes).toString()}`,
    truncated: true,
  };
}

export interface HostCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  truncated: boolean;
}

export function runHostCommand(
  command: string,
  options?: { readonly timeoutMs?: number },
): Promise<HostCommandResult> {
  const timeout = Math.min(options?.timeoutMs ?? 30_000, 120_000);
  return new Promise((resolvePromise) => {
    execFile(
      "bash",
      ["-c", command],
      { cwd: hostRoot(), timeout, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const out = truncateTail(String(stdout ?? ""), MAX_OUTPUT_BYTES);
        const err = truncateTail(String(stderr ?? ""), MAX_OUTPUT_BYTES);
        resolvePromise({
          stdout: out.text,
          stderr:
            err.text +
            (error && (error as NodeJS.ErrnoException).code === "ETIMEDOUT"
              ? `\n[command timed out after ${timeout}ms]`
              : ""),
          exitCode: typeof (error as { code?: unknown } | null)?.code === "number"
            ? ((error as { code: number }).code as number)
            : error
              ? 1
              : 0,
          truncated: out.truncated || err.truncated,
        });
      },
    );
  });
}

export async function readHostFile(inputPath: string): Promise<{ path: string; content: string; truncated: boolean }> {
  const absolute = resolveInRoot(inputPath);
  const content = await readFile(absolute, "utf8").catch((error: unknown) => {
    throw new Error(`Cannot read ${inputPath}: ${(error as Error).message}`);
  });
  if (Buffer.byteLength(content) > MAX_READ_BYTES) {
    const { text } = truncateTail(content, MAX_READ_BYTES);
    return { path: inputPath, content: text, truncated: true };
  }
  return { path: inputPath, content, truncated: false };
}

export async function writeHostFile(inputPath: string, content: string): Promise<{ path: string; bytes: number }> {
  if (Buffer.byteLength(content) > MAX_WRITE_BYTES) {
    throw new Error(`Content exceeds the 1MB write cap (${Buffer.byteLength(content)} bytes).`);
  }
  const absolute = resolveInRoot(inputPath);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, content, "utf8").catch((error: unknown) => {
    throw new Error(`Cannot write ${inputPath}: ${(error as Error).message}`);
  });
  return { path: inputPath, bytes: Buffer.byteLength(content) };
}
