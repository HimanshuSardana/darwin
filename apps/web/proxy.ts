import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/signin", "/signup"];

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

  let authenticated = false;
  try {
    const sessionResponse = await fetch(new URL("/api/auth/get-session", request.url), {
      headers: { cookie: request.headers.get("cookie") ?? "" },
    });
    if (sessionResponse.ok) {
      const data = (await sessionResponse.json().catch(() => null)) as {
        session?: unknown;
        user?: unknown;
      } | null;
      authenticated = !!(data && (data.session || data.user));
    }
  } catch {
    authenticated = false;
  }

  if (authenticated) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/") || pathname.startsWith("/eve/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/signin";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/", "/s/:path*", "/eve/:path*", "/api/:path*"],
};
