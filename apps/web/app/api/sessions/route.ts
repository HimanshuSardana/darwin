import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  claimSession,
  ownedSessions,
} from "@/lib/server/session-registry";

async function currentUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

/** Sessions owned by the signed-in user. */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ sessions: await ownedSessions(userId) });
}

/** Claim ownership of a session (first writer wins). */
export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { sessionId?: unknown } | null;
  if (!body || typeof body.sessionId !== "string" || body.sessionId.length === 0) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }
  const owner = await claimSession(body.sessionId, userId);
  return NextResponse.json({ sessionId: body.sessionId, owner, mine: owner === userId });
}
