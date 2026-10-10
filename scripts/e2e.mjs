// End-to-end API check against a running server (default http://localhost:3100).
// Simulates two phones: create room -> join -> answer (with GPS) -> both sign -> recorded.
// Usage: BASE_URL=http://localhost:3100 npm run e2e   (server must run with default env, i.e. proximity ON)
import assert from "node:assert/strict";
import { Wallet } from "ethers";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 10143);
const CONTRACT = process.env.NEXT_PUBLIC_SHAKEPROOF_ADDRESS || "0x0000000000000000000000000000000000000000";
const domain = { name: "ShakeProof", version: "1", chainId: CHAIN_ID, verifyingContract: CONTRACT };
const types = {
  Handshake: [
    { name: "sessionId", type: "bytes32" },
    { name: "a", type: "address" },
    { name: "b", type: "address" },
    { name: "questId", type: "bytes32" },
    { name: "deadline", type: "uint64" },
  ],
};

async function call(path, body) {
  const res = await fetch(BASE + path, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}
let passed = 0;
const ok = (m) => { passed++; console.log("  ✓", m); };

const alice = Wallet.createRandom();
const bob = Wallet.createRandom();
const carol = Wallet.createRandom();
const here = { lat: 16.7050, lng: 74.2433, accuracy: 8 };
const nearby = { lat: 16.70503, lng: 74.24335, accuracy: 10 }; // ~7 m away
const farAway = { lat: 16.7150, lng: 74.2533, accuracy: 10 }; // >1 km away

// --- happy path
let r = await call("/api/session", { address: alice.address, name: "Alice" });
assert.equal(r.status, 200);
const code = r.data.code;
r = await call(`/api/session/${code}/join`, { address: bob.address, name: "Bob" });
assert.equal(r.data.status, "quest");
ok("create + join moves room to quest phase");

r = await call(`/api/session/${code}/answer`, { address: alice.address, answer: "Rust, obviously", geo: here });
assert.equal(r.data.me.answered, true);
r = await call(`/api/session/${code}?viewer=${bob.address}`);
assert.equal(r.data.them.answer, undefined, "other side's answer must stay hidden until both answered");
ok("answers stay hidden until both have answered");

r = await call(`/api/session/${code}/answer`, { address: bob.address, answer: "Solidity, sadly", geo: nearby });
assert.equal(r.data.status, "ready");
assert.equal(r.data.proximity, "ok");
assert.equal(r.data.them.answer, "Rust, obviously");
ok("both answered + within range -> ready, answers revealed");

const hs = r.data.handshake;
let sig = await bob.signTypedData(domain, types, hs);
r = await call(`/api/session/${code}/sign`, { address: carol.address, signature: sig });
assert.equal(r.status, 403);
ok("outsider cannot sign");

const wrong = await carol.signTypedData(domain, types, hs);
r = await call(`/api/session/${code}/sign`, { address: bob.address, signature: wrong });
assert.equal(r.status, 400);
ok("signature from the wrong wallet is rejected");

r = await call(`/api/session/${code}/sign`, { address: bob.address, signature: sig });
assert.equal(r.data.status, "signing");
ok("one signature alone does not record a meet");

r = await call(`/api/session/${code}/sign`, { address: alice.address, signature: await alice.signTypedData(domain, types, hs) });
assert.equal(r.data.status, "recorded");
assert.ok(r.data.txHash?.startsWith("0x"));
ok(`both signed -> recorded (${r.data.simulated ? "simulated" : "on-chain"} tx ${r.data.txHash.slice(0, 12)}…)`);

r = await call(`/api/passport/${alice.address}`);
assert.equal(r.data.meets.length, 1);
assert.equal(r.data.meets[0].withName, "Bob");
r = await call("/api/leaderboard");
assert.ok(r.data.some((x) => x.address === alice.address && x.meets === 1));
ok("passport + leaderboard reflect the meet");

// --- same pair again is rejected
r = await call("/api/session", { address: bob.address, name: "Bob" });
const code2 = r.data.code;
await call(`/api/session/${code2}/join`, { address: alice.address, name: "Alice" });
await call(`/api/session/${code2}/answer`, { address: bob.address, answer: "again?", geo: here });
r = await call(`/api/session/${code2}/answer`, { address: alice.address, answer: "again!", geo: nearby });
const hs2 = r.data.handshake;
await call(`/api/session/${code2}/sign`, { address: bob.address, signature: await bob.signTypedData(domain, types, hs2) });
r = await call(`/api/session/${code2}/sign`, { address: alice.address, signature: await alice.signTypedData(domain, types, hs2) });
assert.equal(r.data.status, "failed");
assert.match(r.data.failReason, /already/i);
ok("same pair cannot be farmed a second time");

// --- too far apart
r = await call("/api/session", { address: alice.address, name: "Alice" });
const code3 = r.data.code;
await call(`/api/session/${code3}/join`, { address: carol.address, name: "Carol" });
await call(`/api/session/${code3}/answer`, { address: alice.address, answer: "hi", geo: here });
r = await call(`/api/session/${code3}/answer`, { address: carol.address, answer: "hello", geo: farAway });
assert.equal(r.data.proximity, "too_far");
assert.notEqual(r.data.status, "ready");
const hs3 = r.data.handshake;
r = await call(`/api/session/${code3}/sign`, { address: carol.address, signature: await carol.signTypedData(domain, types, hs3) });
assert.equal(r.status, 409);
ok("people far apart cannot sign");

// --- room is full
r = await call(`/api/session/${code3}/join`, { address: bob.address, name: "Bob" });
assert.equal(r.status, 409);
ok("third person cannot join a full room");

console.log(`\nAll ${passed} e2e checks passed.`);
