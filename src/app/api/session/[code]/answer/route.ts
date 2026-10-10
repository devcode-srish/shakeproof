import { NextResponse } from "next/server";
import { cleanAddress, isExpired, refreshStatus, roleOf, toView } from "@/lib/sessions";
import { getSession, saveSession } from "@/lib/store";
import type { Geo } from "@/lib/types";

function cleanGeo(raw: unknown): Geo | undefined {
  const g = raw as Partial<Geo> | undefined;
  if (!g || typeof g.lat !== "number" || typeof g.lng !== "number") return undefined;
  if (Math.abs(g.lat) > 90 || Math.abs(g.lng) > 180) return undefined;
  return { lat: g.lat, lng: g.lng, accuracy: typeof g.accuracy === "number" ? g.accuracy : undefined };
}

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const s = getSession(code);
  if (!s) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (isExpired(s)) return NextResponse.json({ error: "Session expired" }, { status: 410 });
  if (s.status === "recorded") return NextResponse.json({ error: "Already recorded" }, { status: 409 });

  const body = (await req.json().catch(() => ({}))) as { address?: string; answer?: string; geo?: unknown };
  const address = cleanAddress(body.address);
  const role = roleOf(s, address);
  if (role === "none") return NextResponse.json({ error: "You are not in this session" }, { status: 403 });

  const me = role === "a" ? s.a : s.b!;
  if (typeof body.answer === "string") {
    const answer = body.answer.replace(/[<>]/g, "").trim().slice(0, 140);
    if (answer.length < 2) return NextResponse.json({ error: "Write a short answer first" }, { status: 400 });
    me.answer = answer;
  }
  const geo = cleanGeo(body.geo);
  if (geo) me.geo = geo;

  refreshStatus(s);
  saveSession(s);
  return NextResponse.json(toView(s, address));
}
