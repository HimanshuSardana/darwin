import { execFile } from "node:child_process";
import { statSync } from "node:fs";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

function binary(): string {
  if (process.env.AGENT_BROWSER_BIN) return process.env.AGENT_BROWSER_BIN;
  const local = `${process.cwd()}/node_modules/.bin/agent-browser`;
  try {
    statSync(local);
    return local;
  } catch {
    return "agent-browser";
  }
}

/**
 * Live stream status for the chat's browser panel (authed). The browser
 * session auto-starts its WebSocket server; the UI connects to it directly
 * (same machine, localhost) to render frames.
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const output: string = await new Promise((resolve, reject) => {
      execFile(
        binary(),
        ["stream", "status", "--json"],
        { timeout: 15000, maxBuffer: 1024 * 1024 },
        (error, stdout) => {
          if (error) reject(error);
          else resolve(String(stdout));
        },
      );
    });
    const parsed = JSON.parse(output) as {
      data?: { connected?: boolean; enabled?: boolean; port?: number; screencasting?: boolean };
    };
    const data = parsed.data ?? {};
    return NextResponse.json({
      connected: data.connected === true,
      enabled: data.enabled === true,
      port: typeof data.port === "number" ? data.port : null,
      screencasting: data.screencasting === true,
    });
  } catch {
    return NextResponse.json({ connected: false, enabled: false, port: null, screencasting: false });
  }
}
