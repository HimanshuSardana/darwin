import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listModelCalls } from "@/lib/server/trace-store";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const limit = Math.min(
    Math.max(Number(params.get("limit") ?? 50), 1),
    200,
  );
  const requested = params.get("sessionId");
  const sessionFilter = requested && /^[A-Za-z0-9_-]{1,128}$/.test(requested) ? requested : undefined;
  return NextResponse.json({ calls: await listModelCalls(limit, sessionFilter) });
}
