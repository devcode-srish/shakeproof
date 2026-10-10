import { NextResponse } from "next/server";
import { cleanAddress, cleanName, createSession } from "@/lib/sessions";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { address?: string; name?: string };
  const address = cleanAddress(body.address);
  if (!address) return NextResponse.json({ error: "Valid wallet address required" }, { status: 400 });
  const s = await createSession(address, cleanName(body.name));
  return NextResponse.json({ code: s.code });
}
