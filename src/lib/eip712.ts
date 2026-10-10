import { CHAIN_ID, SHAKEPROOF_ADDRESS } from "@/lib/config";

export const handshakeDomain = {
  name: "ShakeProof",
  version: "1",
  chainId: CHAIN_ID,
  verifyingContract: SHAKEPROOF_ADDRESS,
};

export const handshakeTypes = {
  Handshake: [
    { name: "sessionId", type: "bytes32" },
    { name: "a", type: "address" },
    { name: "b", type: "address" },
    { name: "questId", type: "bytes32" },
    { name: "deadline", type: "uint64" },
  ],
};

export type HandshakeValue = {
  sessionId: string;
  a: string;
  b: string;
  questId: string;
  deadline: number;
};
