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

export async function onChainReadiness(): Promise<{ ready: true } | { ready: false; reason: string }> {
  if (!CONTRACT_DEPLOYED) {
    return { ready: false, reason: "Deploy the ShakeProof contract and set NEXT_PUBLIC_SHAKEPROOF_ADDRESS in .env.local." };
  }
  const signer = relayer();
  if (!signer) {
    return { ready: false, reason: "Set RELAYER_PRIVATE_KEY in .env.local to a wallet funded with Monad testnet MON." };
  }

  try {
    const provider = signer.provider;
    if (!provider) return { ready: false, reason: "Monad relayer has no RPC provider configured." };
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== CHAIN_ID) {
      return { ready: false, reason: `RPC chain ID mismatch: expected ${CHAIN_ID}, received ${network.chainId}.` };
    }
    const code = await provider.getCode(SHAKEPROOF_ADDRESS);
    if (code === "0x") {
      return { ready: false, reason: "No contract is deployed at NEXT_PUBLIC_SHAKEPROOF_ADDRESS on this Monad network." };
    }
    if ((await provider.getBalance(signer.address)) === 0n) {
      return { ready: false, reason: "The relayer wallet has no MON for transaction gas. Fund it on Monad testnet." };
    }
    return { ready: true };
  } catch (e) {
    const message = e instanceof Error ? e.message.slice(0, 180) : "RPC request failed";
    return { ready: false, reason: `Could not verify the Monad contract: ${message}` };
  }
}

export type RecordResult =
  | { ok: true; txHash: string }
  | { ok: false; reason: string };

/** Submit both participant signatures to the configured Monad contract. */
export async function recordMeetOnChain(
  value: HandshakeValue,
  sigA: string,
  sigB: string,
): Promise<RecordResult> {
  const readiness = await onChainReadiness();
  if (!readiness.ready) return { ok: false, reason: readiness.reason };

  const signer = relayer();
  if (!signer) return { ok: false, reason: "Monad relayer configuration is invalid." };

  try {
    const contract = new Contract(SHAKEPROOF_ADDRESS, shakeproofAbi, signer);
    if (await contract.haveMet(value.a, value.b)) {
      return { ok: false, reason: "You two have already shaken hands on-chain. Each pair counts once." };
    }
    const tx = await contract.recordMeet(value, sigA, sigB);
    await tx.wait();
    return { ok: true, txHash: tx.hash };
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
