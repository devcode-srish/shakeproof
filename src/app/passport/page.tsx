"use client";

import { useEffect, useState } from "react";
import { EXPLORER_TX_BASE } from "@/lib/config";
import type { MeetRecord } from "@/lib/types";
import { exportKey, importKey, shortAddr, tierFor, useIdentity } from "@/lib/wallet";

type Passport = { meets: MeetRecord[]; onChainMeetCount: number | null };

export default function PassportPage() {
  const { address, name, setName, ready, reload } = useIdentity();
  const [data, setData] = useState<Passport | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!address) return;
    let live = true;
    const load = async () => {
      const res = await fetch(`/api/passport/${address}`, { cache: "no-store" });
      if (res.ok && live) setData((await res.json()) as Passport);
    };
    load();
    const id = setInterval(load, 5000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [address]);

  if (!ready) return <p className="muted pt-10 text-center">Loading passport…</p>;

  const count = data?.onChainMeetCount ?? data?.meets.length ?? 0;
  const tier = tierFor(count);

  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black">Meet Passport</h1>
          <span className="pill text-[var(--lime)]">
            {tier.emoji} {tier.label}
          </span>
        </div>
        <input className="input" maxLength={24} value={name} placeholder="Trainer name" onChange={(e) => setName(e.target.value)} />
        <p className="muted font-mono text-xs break-all">{address}</p>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl border-2 border-[var(--line)] p-3">
            <div className="text-3xl font-black">{count}</div>
            <div className="muted text-xs">verified meets</div>
          </div>
          <div className="rounded-xl border-2 border-[var(--line)] p-3">
            <div className="text-3xl font-black">{tier.next ? tier.next - count : "MAX"}</div>
            <div className="muted text-xs">{tier.next ? "more to level up" : "tier reached"}</div>
          </div>
        </div>
        {data?.onChainMeetCount !== null && data?.onChainMeetCount !== undefined && (
          <p className="muted text-xs">Count read straight from the ShakeProof contract.</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-black">Handshake history</h2>
        {data?.meets.length === 0 && (
          <div className="card muted text-center text-sm">No handshakes yet. Go meet someone! 🤝</div>
        )}
        {data?.meets.map((m) => (
          <div key={m.sessionCode} className="card flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <b>{m.withName}</b>
              <span className="muted font-mono text-xs">{shortAddr(m.withAddress)}</span>
            </div>
            <p className="muted text-sm">{m.questPrompt}</p>
            <p className="text-sm">
              <b>You:</b> {m.myAnswer}
            </p>
            <p className="text-sm">
              <b>{m.withName}:</b> {m.theirAnswer}
            </p>
            <p className="text-xs">
              {m.simulated ? (
                <span className="pill text-[var(--pink)]">simulated</span>
              ) : (
                <a className="underline" target="_blank" rel="noreferrer" href={`${EXPLORER_TX_BASE}${m.txHash}`}>
                  tx ↗
                </a>
              )}
            </p>
          </div>
        ))}
      </section>

      <section className="card flex flex-col gap-2">
        <h2 className="font-black">Wallet backup</h2>
        <p className="muted text-sm">
          This is a throwaway testnet wallet stored in your browser. Export the key to keep your passport on
          another device. Never put real funds here.
        </p>
        <button className="btn btn-ghost" onClick={() => setShowKey((v) => !v)}>
          {showKey ? "Hide private key" : "Reveal private key"}
        </button>
        {showKey && <p className="font-mono text-xs break-all text-[var(--pink)]">{exportKey()}</p>}
        <div className="flex gap-2">
          <input className="input font-mono text-xs" placeholder="Import a 0x… private key" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} />
          <button
            className="btn btn-ghost"
            onClick={() => {
              if (importKey(keyInput)) {
                reload();
                setKeyInput("");
                setMsg("Imported ✓");
              } else setMsg("That key isn't valid");
            }}
          >
            Import
          </button>
        </div>
        {msg && <p className="muted text-xs">{msg}</p>}
      </section>
    </div>
  );
}
