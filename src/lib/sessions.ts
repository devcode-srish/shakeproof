import { getAddress, hexlify, randomBytes } from "ethers";
import { SESSION_TTL_SECONDS } from "@/lib/config";
import { evaluateProximity } from "@/lib/geo";
import { createQuest } from "@/lib/quests";
import { saveSession } from "@/lib/store";
import type { Participant, Session, SessionView } from "@/lib/types";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

export function newCode(): string {
  const bytes = randomBytes(6);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

export function cleanName(raw: unknown): string {
  const s = String(raw ?? "").replace(/[<>]/g, "").trim().slice(0, 24);
  return s || "Anon";
}

export function cleanAddress(raw: unknown): string | null {
  try {
    return getAddress(String(raw));
  } catch {
    return null;
  }
}

export async function createSession(address: string, name: string): Promise<Session> {
  const code = newCode();
  const quest = await createQuest(code);
  const now = Math.floor(Date.now() / 1000);
  const s: Session = {
    code,
    sessionId: hexlify(randomBytes(32)),
    questPrompt: quest.prompt,
    questId: quest.id,
    createdAt: now,
    deadline: now + SESSION_TTL_SECONDS,
    a: { address, name },
    status: "waiting",
  };
  saveSession(s);
  return s;
}

export function isExpired(s: Session): boolean {
  return s.status !== "recorded" && Math.floor(Date.now() / 1000) > s.deadline;
}

export function roleOf(s: Session, address?: string | null): "a" | "b" | "none" {
  if (!address) return "none";
  if (s.a.address.toLowerCase() === address.toLowerCase()) return "a";
  if (s.b && s.b.address.toLowerCase() === address.toLowerCase()) return "b";
  return "none";
}

/** Recomputes the lifecycle status after any mutation. */
export function refreshStatus(s: Session) {
  if (s.status === "recorded" || s.status === "failed") return;
  if (!s.b) {
    s.status = "waiting";
    return;
  }
  const bothAnswered = Boolean(s.a.answer && s.b.answer);
  if (!bothAnswered) {
    s.status = "quest";
    return;
  }
  const { proximity } = evaluateProximity(s);
  if (proximity === "ok" || proximity === "skipped") {
    s.status = s.a.signature || s.b.signature ? "signing" : "ready";
  } else {
    s.status = "quest"; // still gated on proximity
  }
}

function side(p: Participant | undefined, reveal: boolean, isMe: boolean) {
  if (!p) return undefined;
  return {
    name: p.name,
    address: p.address,
    answered: Boolean(p.answer),
    signed: Boolean(p.signature),
    answer: isMe || reveal ? p.answer : undefined,
  };
}

export function toView(s: Session, viewer?: string | null): SessionView {
  const role = roleOf(s, viewer);
  const reveal = Boolean(s.a.answer && s.b?.answer);
  const prox = evaluateProximity(s);
  const meP = role === "a" ? s.a : role === "b" ? s.b : undefined;
  const themP = role === "a" ? s.b : role === "b" ? s.a : undefined;
  return {
    code: s.code,
    status: isExpired(s) && s.status !== "recorded" ? "failed" : s.status,
    questPrompt: s.questPrompt,
    deadline: s.deadline,
    role,
    me: side(meP, reveal, true),
    them: side(themP, reveal, false),
    handshake: s.b
      ? { sessionId: s.sessionId, a: s.a.address, b: s.b.address, questId: s.questId, deadline: s.deadline }
      : undefined,
    proximity: prox.proximity,
    distanceMeters: prox.distanceMeters,
    txHash: s.txHash,
    simulated: s.simulated,
    failReason: isExpired(s) && s.status !== "recorded" ? "Session expired. Start a new one." : s.failReason,
    expired: isExpired(s),
  };
}
