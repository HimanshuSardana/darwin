import { readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { NextResponse } from "next/server";
import type { WorkspaceRecord } from "../route";

function storePath(): string {
  const dir = process.env.DARWIN_DATA_DIR ?? join(homedir(), ".darwin");
  return join(dir, "workspaces.json");
}

export async function DELETE(
  _request: Request,
  { params }: { readonly params: Promise<{ readonly id: string }> },
) {
  const { id } = await params;
  let all: WorkspaceRecord[];
  try {
    all = JSON.parse(await readFile(storePath(), "utf8")) as WorkspaceRecord[];
    if (!Array.isArray(all)) all = [];
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const record = all.find((entry) => entry.id === id);
  if (!record) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  // Remove the host directory for host workspaces; microvm disks stay with
  // their Eve session (durable server-side) and are simply unlinked here.
  if (record.provider === "host" && record.path) {
    await rm(record.path, { recursive: true, force: true });
  }
  await writeFile(
    storePath(),
    JSON.stringify(
      all.filter((entry) => entry.id !== id),
      null,
      2,
    ),
    "utf8",
  );
  return NextResponse.json({ ok: true });
}
