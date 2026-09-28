import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { claimSession, sessionOwner } from "@/lib/server/session-registry";

/**
 * Internal access check used by the edge proxy: verifies the caller and,
 * for session-scoped paths, verifies session ownership.
 *
 * Unknown sessions are claimed first-touch-wins: whoever reaches a fresh
 * session ID first (in practice its creator, milliseconds after creation)
 * becomes the owner. Afterwards only the owner may continue it.
 * Responses are a bare boolean so callers learn nothing about other
 * sessions (no unknown-vs-forbidden distinction).
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id ?? null;
  if (!userId) {
    return NextResponse.json({ allow: false });
  }
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ allow: true });
  }
  let owner: string | null = null;
  try {
    owner = sessionOwner(sessionId);
    if (owner === null) {
      owner = claimSession(sessionId, userId);
    }
  } catch {
    return NextResponse.json({ allow: false });
  }
  return NextResponse.json({ allow: owner === userId });
}
