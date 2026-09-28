import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { claimSession, sessionOwner } from "@/lib/server/session-registry";

/**
 * Internal access check used by the edge proxy: verifies the caller and,
 * for session-scoped paths, verifies session ownership. Same-origin only.
 *
 * Unknown sessions are claimed first-touch-wins: whoever reaches a fresh
 * session ID first (in practice its creator, milliseconds after creation)
 * becomes the owner. Afterwards only the owner may continue it.
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id ?? null;
  if (!userId) {
    return NextResponse.json({ allow: false, reason: "unauthenticated" });
  }
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ allow: true });
  }
  const known = await sessionOwner(sessionId);
  if (known !== null && known !== userId) {
    return NextResponse.json({ allow: false, reason: "forbidden" });
  }
  const owner = await claimSession(sessionId, userId);
  return NextResponse.json({ allow: owner === userId });
}
