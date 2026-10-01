import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTrace } from "@/lib/server/trace-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const spans = await getTrace(id);
  if (!spans) {
    return NextResponse.json({ error: "Trace not found" }, { status: 404 });
  }
  return NextResponse.json({ spans });
}
