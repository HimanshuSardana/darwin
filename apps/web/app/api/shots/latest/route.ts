import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

function shotsDir(): string {
  const base = process.env.DARWIN_DATA_DIR ?? join(homedir(), ".darwin");
  return join(base, "browser-shots");
}

async function currentUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

/** Newest screenshot (for panel polling). */
export async function GET() {
  if (!(await currentUserId())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { readdir } = await import("node:fs/promises");
  try {
    const files = await readdir(shotsDir());
    const pngs = files.filter((file) => /^[A-Za-z0-9_.-]+\.png$/.test(file));
    let latest: string | null = null;
    let latestMtime = -1;
    for (const file of pngs) {
      const mtime = (await stat(join(shotsDir(), file))).mtimeMs;
      if (mtime > latestMtime) {
        latestMtime = mtime;
        latest = file;
      }
    }
    return NextResponse.json({ latest });
  } catch {
    return NextResponse.json({ latest: null });
  }
}
