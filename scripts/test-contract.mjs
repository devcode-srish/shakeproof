// Local contract test: spins up an in-process ganache chain, deploys ShakeProof,
// and checks the happy path + every revert branch. Run: npm run contract:compile && npm run contract:test
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { BrowserProvider, ContractFactory, Wallet, id, randomBytes, hexlify, Interface } from "ethers";
const require = createRequire(import.meta.url);
const ganache = require("ganache");

const root = path.resolve(import.meta.dirname, "..");
const { abi, bytecode } = JSON.parse(fs.readFileSync(path.join(root, "contracts/artifacts/ShakeProof.json"), "utf8"));

const alice = Wallet.createRandom();
const bob = Wallet.createRandom();
const carol = Wallet.createRandom();
const relayerKey = Wallet.createRandom().privateKey;

const server = ganache.server({
  logging: { quiet: true },
  chain: { chainId: 31337 },
  wallet: { accounts: [{ secretKey: relayerKey, balance: "0x56BC75E2D63100000" }] },
});
await server.listen(0);
const port = server.address().port;
const provider = new BrowserProvider(server.provider);
const relayer = new Wallet(relayerKey, provider);

const factory = new ContractFactory(abi, bytecode, relayer);
const c = await factory.deploy();
await c.waitForDeployment();
const verifyingContract = await c.getAddress();

const domain = { name: "ShakeProof", version: "1", chainId: 31337, verifyingContract };
const types = {
  Handshake: [
    { name: "sessionId", type: "bytes32" },
    { name: "a", type: "address" },
    { name: "b", type: "address" },
    { name: "questId", type: "bytes32" },
    { name: "deadline", type: "uint64" },
  ],
};
const mk = (a, b, extra = {}) => ({
  sessionId: hexlify(randomBytes(32)),
  a: a.address,
  b: b.address,
  questId: id("quest-1"),
  deadline: Math.floor(Date.now() / 1000) + 600,
  ...extra,
});
const sign = (w, v) => w.signTypedData(domain, types, v);
// ganache nests the revert payload differently from geth; look in every place it may live.
const errorName = (e) => {
  const iface = new Interface(abi);
  const candidates = [
    e?.data, e?.error?.data, e?.info?.error?.data, e?.info?.error?.data?.result,
    e?.error?.data?.result, e?.data?.result, e?.error?.error?.data,
  ];
  for (const cand of candidates) {
    const hex = typeof cand === "string" ? cand : cand?.result;
    if (typeof hex === "string" && hex.startsWith("0x") && hex.length >= 10) {
      try { return iface.parseError(hex)?.name; } catch { /* keep looking */ }
    }
  }
  return "UNDECODED:" + JSON.stringify(e, (_k, v) => (typeof v === "bigint" ? v.toString() : v)).slice(0, 600);
};
async function expectRevert(promise, name) {
  try { await promise; } catch (e) { assert.equal(errorName(e), name); return; }
  assert.fail(`expected revert ${name}`);
}

let passed = 0;
const ok = (label) => { passed++; console.log("  ✓", label); };

// 1. happy path
{
  const v = mk(alice, bob);
  await (await c.recordMeet(v, await sign(alice, v), await sign(bob, v))).wait();
  assert.equal(await c.meetCount(alice.address), 1n);
  assert.equal(await c.meetCount(bob.address), 1n);
  assert.equal(await c.haveMet(bob.address, alice.address), true);
  ok("records a meet signed by both wallets (counts + pair flag)");
}
// 2. same pair can't repeat (even reversed, new session)
{
  const v = mk(bob, alice);
  await expectRevert(c.recordMeet(v, await sign(bob, v), await sign(alice, v)), "PairAlreadyMet");
  ok("same two wallets cannot be recorded twice");
}
// 3. missing consent: b signature forged by third wallet
{
  const v = mk(alice, carol);
  await expectRevert(c.recordMeet(v, await sign(alice, v), await sign(bob, v)), "BadSignature");
  ok("rejects a signature from the wrong wallet");
}
// 4. one-sided: a signs twice
{
  const v = mk(alice, carol);
  await expectRevert(c.recordMeet(v, await sign(alice, v), await sign(alice, v)), "BadSignature");
  ok("rejects one-sided consent (same signer twice)");
}
// 5. tampered payload
{
  const v = mk(alice, carol);
  const sa = await sign(alice, v), sb = await sign(carol, v);
  await expectRevert(c.recordMeet({ ...v, questId: id("other") }, sa, sb), "BadSignature");
  ok("rejects tampered quest id after signing");
}
// 6. expired
{
  const v = mk(alice, carol, { deadline: Math.floor(Date.now() / 1000) - 5 });
  await expectRevert(c.recordMeet(v, await sign(alice, v), await sign(carol, v)), "Expired");
  ok("rejects expired handshakes");
}
// 7. same wallet
{
  const v = mk(alice, alice);
  await expectRevert(c.recordMeet(v, await sign(alice, v), await sign(alice, v)), "SameWallet");
  ok("rejects a wallet meeting itself");
}
// 8. session replay
{
  const v = mk(alice, carol);
  const sa = await sign(alice, v), sb = await sign(carol, v);
  await (await c.recordMeet(v, sa, sb)).wait();
  await expectRevert(c.recordMeet.staticCall(v, sa, sb), "SessionAlreadyUsed");
  assert.equal(await c.meetCount(carol.address), 1n);
  ok("rejects session replay");
}

console.log(`\nAll ${passed} contract checks passed.`);
await server.close();
process.exit(0);
