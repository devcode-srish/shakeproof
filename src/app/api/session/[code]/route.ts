import { NextResponse } from "next/server";
import { cleanAddress, refreshStatus, toView } from "@/lib/sessions";
import { getSession } from "@/lib/store";

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const s = getSession(code);
  if (!s) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  refreshStatus(s);
  const viewer = cleanAddress(new URL(req.url).searchParams.get("viewer"));
  return NextResponse.json(toView(s, viewer));
}
