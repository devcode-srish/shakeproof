import { NextResponse } from "next/server";
import { cleanAddress, cleanName, isExpired, refreshStatus, roleOf, toView } from "@/lib/sessions";
import { getSession, saveSession } from "@/lib/store";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const s = getSession(code);
  if (!s) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (isExpired(s)) return NextResponse.json({ error: "Session expired" }, { status: 410 });

  const body = (await req.json().catch(() => ({}))) as { address?: string; name?: string };
  const address = cleanAddress(body.address);
  if (!address) return NextResponse.json({ error: "Valid wallet address required" }, { status: 400 });

  if (roleOf(s, address) === "none") {
    if (s.b) return NextResponse.json({ error: "This session already has two people" }, { status: 409 });
    s.b = { address, name: cleanName(body.name) };
    refreshStatus(s);
    saveSession(s);
  }
  return NextResponse.json(toView(s, address));
}
