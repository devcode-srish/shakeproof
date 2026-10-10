import { NextResponse } from "next/server";
import { allSessions } from "@/lib/store";
import type { LeaderboardRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = new Map<string, LeaderboardRow>();
  for (const s of allSessions()) {
    if (s.status !== "recorded" || s.simulated || !s.txHash || !s.b) continue;
    for (const p of [s.a, s.b]) {
      const key = p.address.toLowerCase();
      const row = rows.get(key) ?? { address: p.address, name: p.name, meets: 0 };
      row.meets += 1;
      row.name = p.name;
      rows.set(key, row);
    }
  }
  const sorted = [...rows.values()].sort((x, y) => y.meets - x.meets).slice(0, 25);
  return NextResponse.json(sorted);
}
