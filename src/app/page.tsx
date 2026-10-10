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
    <div className="page-stack">
      <section className="home-hero">
        <p className="pill mb-4">✦ Built on Monad testnet</p>
        <h1>
          Meet in real life.
          <br />
          <span>Make it count.</span>
        </h1>
        <p className="home-hero-copy">
          A meetup counts when <b>both of you</b> are in the same place, share a little conversation, and sign
          the same handshake. No signature from the other person, no proof.
        </p>
      </section>

      <div className="home-grid">
        <section className="card home-action-card">
          <div>
            <p className="eyebrow">Start here</p>
            <h2 className="mt-2">Make a little room for a real connection.</h2>
          </div>
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
          {error && <p className="text-sm text-[var(--pink)]" role="alert">{error}</p>}
        </section>

        <section className="card home-action-card">
          <div>
            <p className="eyebrow">Have an invite?</p>
            <h2 className="mt-2">Join someone who&apos;s already here.</h2>
          </div>
          <div className="flex gap-2">
            <input
              className="input font-mono uppercase tracking-widest"
              placeholder="ABC234"
              maxLength={8}
              aria-label="Handshake invite code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && join()}
            />
            <button className="btn btn-ghost" onClick={join}>
              Join
            </button>
          </div>
          <p className="muted text-xs">Or scan their QR code to open the room directly.</p>
        </section>
      </div>

      <section className="steps-grid" aria-label="How ShakeProof works">
        {[
          ["01", "Meet", "Open a room and share its invite QR with the person beside you."],
          ["02", "Break the ice", "Answer one fun prompt each to confirm you’re both present."],
          ["03", "Make it official", "Both wallets sign the same handshake. The contract verifies it."],
        ].map(([number, title, description]) => (
          <div key={number} className="card step-card">
            <p className="eyebrow">{number} / {title}</p>
            <p className="muted mt-2 text-sm">{description}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
