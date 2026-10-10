"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useRef, useState } from "react";
import { EXPLORER_TX_BASE } from "@/lib/config";
import { handshakeDomain, handshakeTypes } from "@/lib/eip712";
import type { SessionView } from "@/lib/types";
import { shortAddr, useIdentity } from "@/lib/wallet";

async function api(path: string, body?: unknown): Promise<SessionView> {
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data as SessionView;
}

function getPosition(): Promise<{ lat: number; lng: number; accuracy?: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    );
  });
}

function useCountdown(deadline?: number) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!deadline) return;
    const tick = () => setLeft(Math.max(0, deadline - Math.floor(Date.now() / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
}

export default function SessionRoom() {
  const { code: rawCode } = useParams<{ code: string }>();
  const code = String(rawCode).toUpperCase();
  const { wallet, address, name, setName, ready } = useIdentity();

  const [view, setView] = useState<SessionView | null>(null);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const geoSent = useRef(false);

  useEffect(() => setOrigin(window.location.origin), []);

  const refresh = useCallback(async () => {
    if (!address) return;
    try {
      setView(await api(`/api/session/${code}?viewer=${address}`));
    } catch (e) {
      if (e instanceof Error && /not found/i.test(e.message)) setNotFound(true);
    }
  }, [address, code]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 1500);
    return () => clearInterval(id);
  }, [refresh]);

  const run = async (fn: () => Promise<SessionView>) => {
    setBusy(true);
    setError("");
    try {
      setView(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const join = () => run(() => api(`/api/session/${code}/join`, { address, name: name || "Anon" }));

  const submitAnswer = () =>
    run(async () => {
      const geo = await getPosition();
      if (geo) geoSent.current = true;
      return api(`/api/session/${code}/answer`, { address, answer, geo: geo ?? undefined });
    });

  const shareLocation = () =>
    run(async () => {
      const geo = await getPosition();
      if (!geo) throw new Error("Location permission is needed to prove you're together");
      geoSent.current = true;
      return api(`/api/session/${code}/answer`, { address, geo });
    });

  const sign = () =>
    run(async () => {
      if (!wallet || !view?.handshake) throw new Error("Wallet not ready");
      const signature = await wallet.signTypedData(handshakeDomain, handshakeTypes, view.handshake);
      return api(`/api/session/${code}/sign`, { address, signature });
    });

  const countdown = useCountdown(view?.deadline);

  if (notFound) {
    return (
      <div className="card text-center">
        <h1 className="text-2xl font-black">Room {code} not found</h1>
        <p className="muted mt-2">It may have expired. Rooms live for 15 minutes.</p>
        <Link href="/" className="btn btn-primary mt-4">
          Start a new one
        </Link>
      </div>
    );
  }

  if (!ready || !view) return <p className="muted pt-10 text-center">Entering room {code}…</p>;

  const link = origin ? `${origin}/session/${code}` : "";
  const myAnswered = Boolean(view.me?.answered);
  const mySigned = Boolean(view.me?.signed);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">
          Room <span className="font-mono tracking-widest text-[var(--lime)]">{code}</span>
        </h1>
        {view.status !== "recorded" && view.status !== "failed" && (
          <span className="pill muted">⏳ {countdown}</span>
        )}
      </div>

      {/* Not a participant yet */}
      {view.role === "none" && view.status === "waiting" && (
        <div className="card flex flex-col gap-3">
          <h2 className="text-lg font-black">Someone invited you to shake hands</h2>
          <input
            className="input"
            placeholder="Your trainer name"
            maxLength={24}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn btn-primary" disabled={busy} onClick={join}>
            🤝 Join room
          </button>
        </div>
      )}
      {view.role === "none" && view.status !== "waiting" && view.status !== "recorded" && (
        <div className="card">
          <p>This room already has two people.</p>
        </div>
      )}

      {/* Creator waiting for partner */}
      {view.role === "a" && view.status === "waiting" && (
        <div className="card flex flex-col items-center gap-4 text-center">
          <h2 className="text-lg font-black">Show this to the person next to you</h2>
          {link && (
            <div className="rounded-2xl bg-white p-3">
              <QRCodeSVG value={link} size={200} />
            </div>
          )}
          <p className="font-mono text-3xl font-black tracking-[0.3em]">{code}</p>
          <button
            className="btn btn-ghost"
            onClick={() => {
              navigator.clipboard?.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Copied ✓" : "Copy invite link"}
          </button>
          <p className="muted text-sm">Waiting for them to join…</p>
        </div>
      )}

      {/* Both present */}
      {view.me && view.them && view.status !== "recorded" && view.status !== "failed" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {[view.me, view.them].map((p, i) => (
              <div key={p.address} className="card text-center">
                <div className="text-3xl">{i === 0 ? "🧑‍💻" : "👋"}</div>
                <div className="mt-1 font-black">
                  {p.name} {i === 0 && <span className="muted font-normal">(you)</span>}
                </div>
                <div className="muted font-mono text-xs">{shortAddr(p.address)}</div>
                <div className="mt-2 flex justify-center gap-1.5">
                  <span className={`pill ${p.answered ? "text-[var(--lime)]" : "muted"}`}>
                    {p.answered ? "✓ answered" : "…thinking"}
                  </span>
                  <span className={`pill ${p.signed ? "text-[var(--lime)]" : "muted"}`}>
                    {p.signed ? "✓ signed" : "unsigned"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="card flex flex-col gap-3">
            <p className="pill w-fit text-[var(--pink)]">🎲 Icebreaker quest</p>
            <p className="text-lg font-bold">{view.questPrompt}</p>

            {!myAnswered ? (
              <>
                <textarea
                  className="input min-h-20"
                  maxLength={140}
                  placeholder="Your one-line answer…"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                />
                <button className="btn btn-primary" disabled={busy || answer.trim().length < 2} onClick={submitAnswer}>
                  Lock in my answer 📍
                </button>
                <p className="muted text-xs">
                  Submitting also shares your location once, only to check you&apos;re near each other. Exact
                  coordinates are never shown to the other person.
                </p>
              </>
            ) : (
              <p className="muted text-sm">
                Your answer: <b className="text-[var(--text)]">{view.me.answer}</b>
              </p>
            )}

            {view.them.answer && view.me.answer && (
              <p className="answer-panel p-3 text-sm">
                <b>{view.them.name}</b> said: {view.them.answer}
              </p>
            )}
          </div>

          {myAnswered && view.proximity === "unknown" && (
            <div className="card flex flex-col gap-2">
              <p className="font-bold">📍 Waiting for both locations</p>
              <p className="muted text-sm">We need both of you to share location to confirm you&apos;re together.</p>
              <button className="btn btn-ghost" disabled={busy} onClick={shareLocation}>
                Share my location
              </button>
            </div>
          )}
          {view.proximity === "too_far" && (
            <div className="card border-[var(--pink)]">
              <p className="font-black text-[var(--pink)]">You look about {view.distanceMeters} m apart</p>
              <p className="muted text-sm">Walk closer and tap the button below, then try again.</p>
              <button className="btn btn-ghost mt-2" disabled={busy} onClick={shareLocation}>
                Re-check my location
              </button>
            </div>
          )}

          {(view.status === "ready" || view.status === "signing") && (
            <div className="card flex flex-col gap-3 text-center">
              <h2 className="text-lg font-black">Both answered. Seal the handshake.</h2>
              <p className="muted text-sm">
                You sign off-chain (free). Once both signatures exist, the contract records the meet for both of
                you.
              </p>
              <button className="btn btn-primary text-lg" disabled={busy || mySigned} onClick={sign}>
                {mySigned ? "Signed ✓ waiting for them…" : "✍️ Sign handshake"}
              </button>
            </div>
          )}
        </>
      )}

      {/* Recorded */}
      {view.status === "recorded" && (
        <div className="card pop flex flex-col items-center gap-3 text-center">
          <div className="text-6xl">🤝</div>
          <h2 className="text-2xl font-black text-[var(--lime)]">Handshake recorded!</h2>
          {view.me && view.them && (
            <p>
              <b>{view.me.name}</b> × <b>{view.them.name}</b>
            </p>
          )}
          <p className="muted text-sm">{view.questPrompt}</p>
          {view.me?.answer && view.them?.answer && (
            <div className="grid w-full gap-2 text-left text-sm sm:grid-cols-2">
              <p className="answer-panel p-3">
                <b>{view.me.name}:</b> {view.me.answer}
              </p>
              <p className="answer-panel p-3">
                <b>{view.them.name}:</b> {view.them.answer}
              </p>
            </div>
          )}
          {view.txHash && (
            <p className="text-sm">
              <a className="underline" target="_blank" rel="noreferrer" href={`${EXPLORER_TX_BASE}${view.txHash}`}>
                View transaction on MonadVision ↗
              </a>
            </p>
          )}
          <div className="flex gap-2">
            <Link className="btn btn-primary" href="/passport">
              See my passport
            </Link>
            <Link className="btn btn-ghost" href="/">
              Meet someone else
            </Link>
          </div>
        </div>
      )}

      {view.status === "failed" && (
        <div className="card text-center">
          <h2 className="text-xl font-black text-[var(--pink)]">This handshake didn&apos;t go through</h2>
          <p className="muted mt-1">{view.failReason ?? "Unknown error"}</p>
          <Link href="/" className="btn btn-primary mt-4">
            Start over
          </Link>
        </div>
      )}

      {error && <p className="text-center text-sm text-[var(--pink)]">{error}</p>}
    </div>
  );
}
