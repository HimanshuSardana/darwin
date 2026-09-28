import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/signin", "/signup"];

/**
 * Origin for internal verification fetches. Built from a fixed env host —
 * never from the incoming Host header, which is attacker-controlled and
 * would turn the forwarded session cookie into an SSRF credential leak.
 */
const INTERNAL_ORIGIN = process.env.INTERNAL_ORIGIN ?? "http://127.0.0.1:3000";

async function checkAccess(cookie: string, sessionId?: string): Promise<boolean> {
  const accessUrl = new URL("/api/internal/access", INTERNAL_ORIGIN);
  if (sessionId) accessUrl.searchParams.set("sessionId", sessionId);
  try {
    const accessResponse = await fetch(accessUrl, {
      headers: { cookie },
      signal: AbortSignal.timeout(5000),
    });
    const data = (await accessResponse.json().catch(() => null)) as {
      allow?: unknown;
    } | null;
    return accessResponse.ok && data?.allow === true;
  } catch {
    return false;
  }
}

/**
 * Edge entry point (Next 16 `proxy.ts` replaces `middleware.ts`).
 * Runs the scaffold's Vercel-router fix, then gates pages and APIs behind
 * Better Auth. Edge-safe: verifies the session through the internal
 * get-session endpoint (plain HTTP, cookies forwarded) since SQLite is
 * unreachable from the edge.
 */
export default async function proxy(request: NextRequest) {
  const routerHost = process.env.VERCEL_URL;
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (process.env.__VERCEL_DEV_RUNNING === "1" && routerHost && forwardedHost !== routerHost) {
    const target = request.nextUrl.clone();
    target.protocol = "http:";
    target.host = routerHost;
    return NextResponse.redirect(target);
  }

  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }
  // Internal helpers answer for the caller's own cookie; never gate them.
  // (Gating them here would recurse: the checks below call this endpoint.)
  if (pathname.startsWith("/api/internal/")) {
    return NextResponse.next();
  }

  // Session-scoped Eve routes additionally enforce per-user ownership
  // (Eve itself does not: possession of a session ID is not authorization).
  // Creation, health, and info carry no session ID and need auth only.
  if (pathname.startsWith("/eve/")) {
    const match = /^\/eve\/v1\/session\/([^/]+)/.exec(pathname);
    const allowed = await checkAccess(request.headers.get("cookie") ?? "", match?.[1]);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.next();
  }

  const authenticated = await checkAccess(request.headers.get("cookie") ?? "");
  if (authenticated) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/") || pathname.startsWith("/eve/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/signin";
  url.searchParams.set("next", pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  // Catch-all (minus static assets): any future page is gated by default.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
