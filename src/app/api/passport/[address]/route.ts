import { NextResponse } from "next/server";
import { onChainMeetCount } from "@/lib/chain";
import { cleanAddress } from "@/lib/sessions";
import { allSessions } from "@/lib/store";
import type { MeetRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ address: string }> }) {
  const { address: raw } = await ctx.params;
  const address = cleanAddress(raw);
  if (!address) return NextResponse.json({ error: "Bad address" }, { status: 400 });

  const meets: MeetRecord[] = [];
  for (const s of allSessions()) {
    if (s.status !== "recorded" || !s.b || !s.txHash) continue;
    const isA = s.a.address.toLowerCase() === address.toLowerCase();
    const isB = s.b.address.toLowerCase() === address.toLowerCase();
    if (!isA && !isB) continue;
    const me = isA ? s.a : s.b;
    const them = isA ? s.b : s.a;
    meets.push({
      sessionCode: s.code,
      withName: them.name,
      withAddress: them.address,
      questPrompt: s.questPrompt,
      myAnswer: me.answer ?? "",
      theirAnswer: them.answer ?? "",
      txHash: s.txHash,
      simulated: Boolean(s.simulated),
      recordedAt: s.recordedAt ?? 0,
    });
  }
  meets.sort((x, y) => y.recordedAt - x.recordedAt);
  const onChain = await onChainMeetCount(address);
  return NextResponse.json({ address, meets, onChainMeetCount: onChain });
}
