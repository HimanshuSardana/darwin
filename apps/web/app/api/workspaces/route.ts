import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export interface WorkspaceRecord {
  readonly id: string;
  readonly name: string;
  readonly provider: "microvm" | "host";
  /** Owner's user id. Records predating ownership are visible to no one. */
  readonly ownerId: string;
  /** Bound Eve session for microvm workspaces (owns the persistent sandbox). */
  readonly sessionId: string | null;
  /** Host directory for host workspaces. */
  readonly path: string | null;
  readonly createdAt: number;
}

async function currentUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

function dataDir(): string {
  return process.env.DARWIN_DATA_DIR ?? join(homedir(), ".darwin");
}

function storePath(): string {
  return join(dataDir(), "workspaces.json");
}

function workspaceRoot(): string {
  return join(dataDir(), "workspaces");
}

async function loadAll(): Promise<WorkspaceRecord[]> {
  try {
    const raw = await readFile(storePath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WorkspaceRecord[]) : [];
  } catch {
    return [];
  }
}

async function saveAll(records: WorkspaceRecord[]): Promise<void> {
  await mkdir(dataDir(), { recursive: true });
  await writeFile(storePath(), JSON.stringify(records, null, 2), "utf8");
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const all = await loadAll();
  return NextResponse.json({
    workspaces: all.filter((entry) => entry.ownerId === userId),
  });
}

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    provider?: unknown;
    sessionId?: unknown;
  } | null;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 60) : "";
  const provider = body?.provider === "host" ? "host" : "microvm";
  const sessionId =
    provider === "microvm" && typeof body?.sessionId === "string" ? body.sessionId : null;
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (provider === "microvm" && !sessionId) {
    return NextResponse.json(
      { error: "sessionId is required for microvm workspaces" },
      { status: 400 },
    );
  }
  const id = crypto.randomUUID().slice(0, 8);
  let path: string | null = null;
  if (provider === "host") {
    path = join(workspaceRoot(), id);
    await mkdir(path, { recursive: true });
  }
  const record: WorkspaceRecord = {
    id,
    name,
    provider,
    ownerId: userId,
    sessionId,
    path,
    createdAt: Date.now(),
  };
  const all = await loadAll();
  all.push(record);
  await saveAll(all);
  return NextResponse.json({ workspace: record }, { status: 201 });
}
