import { NextResponse } from "next/server";
import { onChainReadiness, recordMeetOnChain, verifySignature } from "@/lib/chain";
import { cleanAddress, isExpired, refreshStatus, roleOf, toView } from "@/lib/sessions";
import { getSession, saveSession } from "@/lib/store";

const inFlight = new Set<string>();

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const s = getSession(code);
  if (!s) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (isExpired(s)) return NextResponse.json({ error: "Session expired" }, { status: 410 });
  if (!s.b) return NextResponse.json({ error: "Waiting for the other person to join" }, { status: 409 });
  if (s.status === "recorded") return NextResponse.json(toView(s, null));

  const body = (await req.json().catch(() => ({}))) as { address?: string; signature?: string };
  const address = cleanAddress(body.address);
  const role = roleOf(s, address);
  if (role === "none" || !address) return NextResponse.json({ error: "You are not in this session" }, { status: 403 });

  const readiness = await onChainReadiness();
  if (!readiness.ready) return NextResponse.json({ error: readiness.reason }, { status: 503 });

  refreshStatus(s);
  if (s.status !== "ready" && s.status !== "signing") {
    return NextResponse.json(
      { error: "Finish the icebreaker (and be within range of each other) before signing" },
      { status: 409 },
    );
  }

  const handshake = {
    sessionId: s.sessionId,
    a: s.a.address,
    b: s.b.address,
    questId: s.questId,
    deadline: s.deadline,
  };
  if (!body.signature || !verifySignature(handshake, body.signature, address)) {
    return NextResponse.json({ error: "Signature does not match this handshake" }, { status: 400 });
  }

  (role === "a" ? s.a : s.b)!.signature = body.signature;
  refreshStatus(s);
  saveSession(s);

  if (s.a.signature && s.b.signature && !inFlight.has(s.code)) {
    inFlight.add(s.code);
    try {
      const result = await recordMeetOnChain(handshake, s.a.signature, s.b.signature);
      if (result.ok) {
        s.status = "recorded";
        s.txHash = result.txHash;
        s.recordedAt = Date.now();
      } else {
        s.status = "failed";
        s.failReason = result.reason;
      }
      saveSession(s);
    } finally {
      inFlight.delete(s.code);
    }
  }
  return NextResponse.json(toView(s, address));
}
