"use client";

import { useEffect, useState } from "react";
import type { LeaderboardRow } from "@/lib/types";
import { shortAddr, tierFor } from "@/lib/wallet";

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);

  useEffect(() => {
    let live = true;
    const load = async () => {
      const res = await fetch("/api/leaderboard", { cache: "no-store" });
      if (res.ok && live) setRows((await res.json()) as LeaderboardRow[]);
    };
    load();
    const id = setInterval(load, 4000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-black">🏆 Top connectors</h1>
      <p className="muted text-sm">Ranked by verified two-sided meets. No farming: each pair counts once.</p>
      <div className="card p-0">
        {rows === null && <p className="muted p-4 text-center">Loading…</p>}
        {rows?.length === 0 && <p className="muted p-4 text-center">Nobody yet. Be the first. 🤝</p>}
        {rows?.map((r, i) => {
          const t = tierFor(r.meets);
          return (
            <div key={r.address} className="flex items-center gap-3 border-t-2 border-[var(--line)] p-3 first:border-t-0">
              <span className="w-8 text-center text-lg font-black">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
              <div className="flex-1">
                <div className="font-bold">{r.name}</div>
                <div className="muted font-mono text-xs">{shortAddr(r.address)}</div>
              </div>
              <span className="pill">
                {t.emoji} {t.label}
              </span>
              <span className="w-8 text-right text-xl font-black text-[var(--lime)]">{r.meets}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
