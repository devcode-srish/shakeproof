import { Contract, JsonRpcProvider, Wallet, verifyTypedData } from "ethers";
import {
  CHAIN_ID,
  CONTRACT_DEPLOYED,
  RPC_URL,
  SHAKEPROOF_ADDRESS,
  shakeproofAbi,
} from "@/lib/config";
import { handshakeDomain, handshakeTypes, type HandshakeValue } from "@/lib/eip712";

export function verifySignature(value: HandshakeValue, signature: string, expected: string): boolean {
  try {
    const signer = verifyTypedData(handshakeDomain, handshakeTypes, value, signature);
    return signer.toLowerCase() === expected.toLowerCase();
  } catch {
    return false;
  }
}

function relayer(): Wallet | null {
  const key = (process.env.RELAYER_PRIVATE_KEY ?? "").trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) return null;
  return new Wallet(key, new JsonRpcProvider(RPC_URL, CHAIN_ID));
}

export function relayerReady(): boolean {
  return CONTRACT_DEPLOYED && relayer() !== null;
}

export type RecordResult =
  | { ok: true; txHash: string; simulated: boolean }
  | { ok: false; reason: string };

function fakeHash(seed: string): string {
  let out = "";
  for (let i = 0; out.length < 64; i++) {
    out += ((seed.charCodeAt(i % seed.length) * 2654435761 + i * 40503) >>> 0).toString(16).padStart(8, "0");
  }
  return "0x" + out.slice(0, 64);
}

/** Submits both signatures to the contract. Falls back to a clearly flagged simulation. */
export async function recordMeetOnChain(
  value: HandshakeValue,
  sigA: string,
  sigB: string,
): Promise<RecordResult> {
  const signer = relayer();
  if (!signer || !CONTRACT_DEPLOYED) {
    await new Promise((r) => setTimeout(r, 350));
    return { ok: true, simulated: true, txHash: fakeHash(value.sessionId + sigA + sigB) };
  }
  try {
    const contract = new Contract(SHAKEPROOF_ADDRESS, shakeproofAbi, signer);
    if (await contract.haveMet(value.a, value.b)) {
      return { ok: false, reason: "You two have already shaken hands on-chain. Each pair counts once." };
    }
    const tx = await contract.recordMeet(value, sigA, sigB);
    await tx.wait();
    return { ok: true, simulated: false, txHash: tx.hash as string };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return { ok: false, reason: `On-chain submit failed: ${msg.slice(0, 160)}` };
  }
}

export async function onChainMeetCount(address: string): Promise<number | null> {
  if (!CONTRACT_DEPLOYED) return null;
  try {
    const contract = new Contract(SHAKEPROOF_ADDRESS, shakeproofAbi, new JsonRpcProvider(RPC_URL, CHAIN_ID));
    return Number(await contract.meetCount(address));
  } catch {
    return null;
  }
}
