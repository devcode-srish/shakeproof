import fs from "node:fs";
import path from "node:path";
import type { Session } from "@/lib/types";

// Tiny persistence layer: in-memory Map mirrored to .data/store.json.
// Good enough for a hackathon demo on ONE long-running server (local, Render, Railway, Fly).
// On serverless hosts (Vercel) memory is not shared between invocations: swap this file
// for Upstash Redis / Supabase (the interface below is all the app uses).

type DB = { sessions: Record<string, Session>; pairs: string[] };

const FILE = path.join(process.cwd(), ".data", "store.json");
const g = globalThis as unknown as { __shakeproofDb?: DB };

function load(): DB {
  try {
    const raw = fs.readFileSync(FILE, "utf8");
    const parsed = JSON.parse(raw) as DB;
    return { sessions: parsed.sessions ?? {}, pairs: parsed.pairs ?? [] };
  } catch {
    return { sessions: {}, pairs: [] };
  }
}

function db(): DB {
  if (!g.__shakeproofDb) g.__shakeproofDb = load();
  return g.__shakeproofDb;
}

function persist() {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(db()));
  } catch {
    /* read-only filesystem: stay in-memory */
  }
}

export function getSession(code: string): Session | undefined {
  return db().sessions[code.toUpperCase()];
}

export function saveSession(session: Session) {
  db().sessions[session.code] = session;
  persist();
}

export function allSessions(): Session[] {
  return Object.values(db().sessions);
}

export function pairKey(x: string, y: string) {
  const [p, q] = [x.toLowerCase(), y.toLowerCase()].sort();
  return `${p}:${q}`;
}

export function hasPair(x: string, y: string) {
  return db().pairs.includes(pairKey(x, y));
}

export function addPair(x: string, y: string) {
  const k = pairKey(x, y);
  if (!db().pairs.includes(k)) db().pairs.push(k);
  persist();
}
