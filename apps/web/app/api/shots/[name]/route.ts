import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

function shotsDir(): string {
  const base = process.env.DARWIN_DATA_DIR ?? join(homedir(), ".darwin");
  return resolve(join(base, "browser-shots"));
}

/** Serve a browser screenshot. Contained to the shots dir, auth required. */
export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<{ readonly name: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { name } = await params;
  if (!/^[A-Za-z0-9_.-]+\.png$/.test(name)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const target = resolve(join(shotsDir(), name));
  if (target !== join(shotsDir(), name) || !target.startsWith(shotsDir() + sep)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  try {
    const bytes = await readFile(target);
    const body: BodyInit = new Uint8Array(bytes) as unknown as BodyInit;
    return new NextResponse(body, {
      headers: {
        "content-type": "image/png",
        "cache-control": "no-store",
        "content-length": String(bytes.length),
      },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
