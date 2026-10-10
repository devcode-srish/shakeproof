export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 10143);
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://testnet-rpc.monad.xyz";
export const EXPLORER_TX_BASE =
  process.env.NEXT_PUBLIC_EXPLORER_TX_BASE ?? "https://testnet.monadvision.com/tx/";
export const SHAKEPROOF_ADDRESS =
  process.env.NEXT_PUBLIC_SHAKEPROOF_ADDRESS && process.env.NEXT_PUBLIC_SHAKEPROOF_ADDRESS !== ""
    ? process.env.NEXT_PUBLIC_SHAKEPROOF_ADDRESS
    : "0x0000000000000000000000000000000000000000";
export const CONTRACT_DEPLOYED = SHAKEPROOF_ADDRESS !== "0x0000000000000000000000000000000000000000";

export const SESSION_TTL_SECONDS = 15 * 60;

export const shakeproofAbi = [
  "function recordMeet((bytes32 sessionId,address a,address b,bytes32 questId,uint64 deadline) h, bytes sigA, bytes sigB)",
  "function meetCount(address) view returns (uint256)",
  "function haveMet(address x, address y) view returns (bool)",
  "event MeetRecorded(bytes32 indexed sessionId, address indexed a, address indexed b, bytes32 questId)",
];
