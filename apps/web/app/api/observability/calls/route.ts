import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listModelCalls } from "@/lib/server/trace-store";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = Math.min(
    Math.max(Number(new URL(request.url).searchParams.get("limit") ?? 50), 1),
    200,
  );
  return NextResponse.json({ calls: await listModelCalls(limit) });
}
