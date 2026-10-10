"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { shortAddr, useIdentity } from "@/lib/wallet";

export default function Home() {
  const router = useRouter();
  const { address, name, setName, ready } = useIdentity();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const start = async () => {
    if (!address) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, name: name || "Anon" }),
      });
      const data = (await res.json()) as { code?: string; error?: string };
      if (!res.ok || !data.code) throw new Error(data.error ?? "Could not start a session");
      router.push(`/session/${data.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  };

  const join = () => {
    const c = code.trim().toUpperCase();
    if (c.length >= 4) router.push(`/session/${c}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="pt-4 text-center">
        <p className="pill mx-auto mb-3 text-[var(--lime)]">⚡ Built on Monad testnet</p>
        <h1 className="text-4xl font-black leading-tight sm:text-5xl">
          Don&apos;t collect people.
          <br />
          <span className="text-[var(--lime)]">Actually meet them.</span>
        </h1>
        <p className="muted mx-auto mt-4 max-w-xl">
          A meetup only counts when <b className="text-white">both of you</b> are in the same place, finish a
          tiny icebreaker, and sign the same handshake. No signature from the other person, no proof.
        </p>
      </section>

      <section className="card flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">Your trainer name</span>
          <input
            className="input"
            placeholder="e.g. SolidityStan"
            maxLength={24}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <p className="muted text-xs">
          Wallet: {ready ? <span className="font-mono">{shortAddr(address)}</span> : "creating…"} (a throwaway
          testnet wallet kept in this browser. Gas is paid by the relayer.)
        </p>
        <button className="btn btn-primary text-lg" disabled={!ready || busy} onClick={start}>
          {busy ? "Opening room…" : "🤝 Start a handshake"}
        </button>
        {error && <p className="text-sm text-[var(--pink)]">{error}</p>}
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="font-black">Got a code from someone nearby?</h2>
        <div className="flex gap-2">
          <input
            className="input font-mono uppercase tracking-widest"
            placeholder="ABC234"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && join()}
          />
          <button className="btn btn-ghost" onClick={join}>
            Join
          </button>
        </div>
        <p className="muted text-xs">Or just scan their QR code, it opens the room directly.</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["1 · Meet", "One person opens a room and shows the QR. The other scans it."],
          ["2 · Icebreak", "Answer one fun prompt each. Answers unlock together."],
          ["3 · Sign", "Both wallets sign the same EIP-712 handshake. The contract checks both."],
        ].map(([t, d]) => (
          <div key={t} className="card">
            <h3 className="font-black text-[var(--lime)]">{t}</h3>
            <p className="muted mt-1 text-sm">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
