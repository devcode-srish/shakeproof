export type Geo = { lat: number; lng: number; accuracy?: number };

export type Participant = {
  address: string;
  name: string;
  answer?: string;
  geo?: Geo;
  signature?: string;
};

export type SessionStatus =
  | "waiting" // creator is waiting for someone to join
  | "quest" // both present, completing the icebreaker
  | "ready" // both answered + proximity ok: signatures can be collected
  | "signing" // at least one signature collected
  | "recorded" // meet transaction is confirmed on-chain
  | "failed";

export type Session = {
  code: string;
  sessionId: string; // bytes32 hex
  questPrompt: string;
  questId: string; // bytes32 hex = keccak256(prompt)
  deadline: number; // unix seconds
  createdAt: number;
  a: Participant;
  b?: Participant;
  status: SessionStatus;
  txHash?: string;
  /** Legacy flag used to hide demo-only records from older persisted stores. */
  simulated?: boolean;
  failReason?: string;
  recordedAt?: number;
};

export type Proximity = "ok" | "too_far" | "unknown" | "skipped";

/** What the browser sees (no raw coordinates, other side's answer hidden until both answered). */
export type SessionView = {
  code: string;
  status: SessionStatus;
  questPrompt: string;
  deadline: number;
  role: "a" | "b" | "none";
  me?: { name: string; address: string; answered: boolean; signed: boolean; answer?: string };
  them?: { name: string; address: string; answered: boolean; signed: boolean; answer?: string };
  handshake?: { sessionId: string; a: string; b: string; questId: string; deadline: number };
  proximity: Proximity;
  distanceMeters?: number;
  txHash?: string;
  failReason?: string;
  expired: boolean;
};

export type MeetRecord = {
  sessionCode: string;
  withName: string;
  withAddress: string;
  questPrompt: string;
  myAnswer: string;
  theirAnswer: string;
  txHash: string;
  recordedAt: number;
};

export type LeaderboardRow = { address: string; name: string; meets: number };
