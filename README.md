# 🤝 ShakeProof — prove you actually met
Our live demo link - https://shakeproof.vercel.app/  

> Mutual-consent, on-chain proof of real-world meetups on **Monad**.
> Two people, one icebreaker, two signatures. No signature from the other person = no proof.

Built for **Monad Blitz** (2-hour build). Single Next.js app + one Solidity contract. No database or third-party accounts required to run the demo.

**Inspiration / credit:** the *general idea* of a gamified real-world networking app on Monad was inspired by the Monad Blitz V3 winner
[Proof-Of-Meet / Proof-Go](https://github.com/chandanjha34/Proof-Go). **This repo shares no code with it.** It is a from-scratch implementation with a different core mechanism (see "What's different" below). If you submit this, say so in your submission, and check the hackathon's originality rules.

---

## 1. TL;DR for whoever picks this up (human or LLM)

- **State: working MVP.** Contract compiled and tested (8/8), API verified end-to-end (11/11) in both *simulated* mode and *real on-chain* mode (local chain). Production build passes. `tsc --noEmit` is clean.
- **Not yet done (needs the owner's secrets/devices):** deploy the contract to Monad testnet, set `.env.local`, deploy the web app, and test on two real phones. See **§7 Runbook** and **§9 Remaining TODOs**.
- **Start here:** read §3 (architecture), then run §7 step 1–3 to see it work locally in 2 minutes.

## 2. The idea & what's different

The Proof-Go style of app lets anyone *collect* anyone's card. ShakeProof flips that: a meetup is recorded **only when both people consent**, and consent is a cryptographic signature.

| Mechanism | How |
|---|---|
| **Mutual consent** | Both wallets sign the *same* EIP-712 `Handshake` struct. The contract recovers both signers; one-sided or forged = revert. |
| **Icebreaker quest** | Each room gets a prompt (Claude-generated if `ANTHROPIC_API_KEY` is set, otherwise a curated deck). Both answer; answers unlock together. The quest id is bound into the signed data. |
| **Proof of presence** | Both phones share GPS once; server checks they're within `MAX_DISTANCE_METERS` (default 100 m, with GPS-accuracy slack). Raw coordinates are never shown to the other user. |
| **Anti-farming** | Contract allows each *pair* of wallets only once and each session id only once. |
| **Gasless for users** | Users sign off-chain (free). A relayer wallet pays gas and submits `recordMeet`. |
| **Passport + tiers** | Lurker → Rookie (1) → Connector (3) → Hub (10), read from the contract's `meetCount`. |

## 3. Architecture

```
 Phone A (burner wallet)                     Phone B (burner wallet)
   │  create room, QR/code                      │  scan QR / enter code
   └───────────────┐                ┌───────────┘
                   ▼                ▼
          Next.js app (src/app) ── API routes (src/app/api)
                   │                       │
                   │              store.ts (in-memory + .data/store.json)
                   │              sessions.ts (lifecycle), geo.ts, quests.ts
                   │                       │  both signatures present?
                   │                       ▼
                   │              chain.ts  ── verifyTypedData (server-side)
                   │                       │   relayer wallet pays gas
                   ▼                       ▼
           polls GET /api/session/:code   ShakeProof.sol on Monad testnet
```

**Room lifecycle** (`SessionStatus` in `src/lib/types.ts`):
`waiting` → `quest` (both present; answers + location) → `ready` (both answered + proximity ok) → `signing` (≥1 signature) → `recorded` | `failed`. Rooms expire after 15 min (`SESSION_TTL_SECONDS`).

**Signed struct** (must match in 3 places: `contracts/ShakeProof.sol`, `src/lib/eip712.ts`, `scripts/test-contract.mjs`/`e2e.mjs`):
```
Handshake(bytes32 sessionId, address a, address b, bytes32 questId, uint64 deadline)
domain: { name: "ShakeProof", version: "1", chainId, verifyingContract }
```
`a` = room creator, `b` = joiner, `questId = keccak256(utf8(prompt))`, `deadline` = room expiry.

## 4. File map

```
contracts/ShakeProof.sol        EIP-712 mutual-signature registry (OpenZeppelin v5 EIP712 + ECDSA)
scripts/compile.mjs             solc-js compile -> contracts/artifacts/ShakeProof.json (ABI + bytecode)
scripts/test-contract.mjs       8 contract tests on an in-process ganache chain
scripts/deploy.mjs              deploy to Monad testnet (uses RELAYER_PRIVATE_KEY)
scripts/e2e.mjs                 11 API checks simulating two phones against a running server
src/lib/config.ts               chain/contract env + ABI fragment
src/lib/eip712.ts               typed-data domain + types (client AND server)
src/lib/store.ts                in-memory Map + JSON file persistence (swap for Redis/Supabase to scale)
src/lib/sessions.ts             create/join/answer logic, status machine, SessionView (privacy filter)
src/lib/quests.ts               icebreaker deck + optional Claude generation
src/lib/geo.ts                  haversine + proximity rule
src/lib/chain.ts                signature verification, relayer submit, simulated fallback, on-chain reads
src/lib/wallet.ts               client burner-wallet hook (localStorage), tiers
src/app/page.tsx                home: name, start room, join by code
src/app/session/[code]/page.tsx the handshake room (QR, quest, location, sign, result)
src/app/passport/page.tsx       passport: tier, history, key export/import
src/app/leaderboard/page.tsx    top connectors
src/app/api/session/**          create / get / join / answer / sign
src/app/api/{leaderboard,passport}/**
```

## 5. API (all JSON)

| Method & path | Body | Notes |
|---|---|---|
| `POST /api/session` | `{address,name}` | creates room, returns `{code}` |
| `GET /api/session/:code?viewer=0x…` | – | returns `SessionView` (other side's answer hidden until both answered) |
| `POST /api/session/:code/join` | `{address,name}` | second person joins; 409 if full |
| `POST /api/session/:code/answer` | `{address, answer?, geo?}` | answer ≤140 chars; `geo={lat,lng,accuracy}` |
| `POST /api/session/:code/sign` | `{address, signature}` | verifies EIP-712 sig; when both present, relayer submits on-chain |
| `GET /api/leaderboard` | – | top 25 by recorded meets |
| `GET /api/passport/:address` | – | history + `onChainMeetCount` (null if no contract) |

## 6. Configuration (`.env.local`, copy from `.env.example`)

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_CHAIN_ID` / `NEXT_PUBLIC_RPC_URL` | Monad testnet defaults: `10143`, `https://testnet-rpc.monad.xyz` |
| `NEXT_PUBLIC_EXPLORER_TX_BASE` | tx link prefix (default `https://testnet.monadexplorer.com/tx/`) |
| `NEXT_PUBLIC_SHAKEPROOF_ADDRESS` | deployed contract. **Empty = simulated mode** (fake tx hash, badge says "simulated") |
| `RELAYER_PRIVATE_KEY` | funded testnet wallet that pays gas. **Testnet key only. Never commit.** |
| `REQUIRE_PROXIMITY` | `true` (default) or `false` for desktop/indoor demos |
| `MAX_DISTANCE_METERS` | default `100` |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | optional AI icebreakers (default model `claude-haiku-5-5`); falls back to curated deck |

⚠️ `NEXT_PUBLIC_*` values are **inlined at build time**. Change them → rebuild (`npm run build`).
⚠️ The EIP-712 `chainId` + `verifyingContract` must be identical on client and server, which is automatic if both are built from the same env.

## 7. Runbook

```bash
# 1. install + run locally (simulated mode, no keys needed)
npm install
REQUIRE_PROXIMITY=false npm run dev        # open http://localhost:3000 in two browser windows (one incognito)

# 2. verify everything
npm run contract:compile && npm run contract:test     # 8 contract checks
npm run typecheck
npm run build && npx next start -p 3100 &             # then:
npm run e2e                                           # BASE_URL=http://localhost:3100 (11 checks)

# 3. go on-chain (Monad testnet)
#   a) create a throwaway wallet, fund it at https://faucet.monad.xyz
#   b) in .env.local set RELAYER_PRIVATE_KEY=0x...
RELAYER_PRIVATE_KEY=0x... npm run contract:deploy     # prints the contract address
#   c) put it in .env.local as NEXT_PUBLIC_SHAKEPROOF_ADDRESS=0x...
npm run build && npm start                            # relayer is now live; txs are real

# 4. phones: geolocation needs HTTPS. Use a deploy (Render/Railway/Fly) or `ngrok http 3000`.
```

**Hosting caveat:** `store.ts` keeps state in process memory (+ a JSON file). Use a **single long-running Node host** (Render, Railway, Fly, a VPS, or ngrok from your laptop). **Vercel serverless will lose sessions between requests.** To run on Vercel, replace `store.ts` with Upstash Redis or Supabase (only `getSession/saveSession/allSessions/hasPair/addPair` are used).

## 8. Demo script (≈90 seconds for judges)

1. Phone A: enter name → **Start a handshake** → shows QR + code.
2. Phone B: scan QR → **Join room**.
3. Both answer the icebreaker; answers reveal together. Location check passes.
4. Both tap **Sign handshake** (gasless).
5. 🤝 *Handshake recorded* → open the Monad Explorer link. Open **Passport** (tier + history) and **Leaders**.
6. Try the same two phones again → *"each pair counts once"*. Talk track: the contract rejects one-sided, forged, expired, replayed, and repeated meets (show `npm run contract:test`).

## 9. Remaining TODOs (priority order, with rough effort)

1. **Deploy + phone test** (30 min): contract to Monad testnet, app to a single-process host over HTTPS, test with two real phones outdoors. *Highest risk item; do this first.*
2. **Auth on join/answer** (20 min): the API trusts the `address` field for join/answer (signing is cryptographically safe). Add a short SIWE-style signature on join/answer so nobody can answer "as" someone else.
3. **Persistent store** (20 min): Upstash/Supabase for serverless hosting.
4. **Soulbound NFT badge** (30 min): mint a non-transferable ERC-721 per tier from the contract (use OpenZeppelin `ERC721` + block transfers in `_update`).
5. **Polish** (30 min): sounds/haptics on record, animated card reveal, shareable "meet card" image.
6. **Real-time** (20 min): replace 1.5 s polling with SSE or Supabase realtime.
7. **Rate limiting / abuse** (15 min): per-IP limits on `POST /api/session`.

## 10. Gotchas (learned the hard way, for the next LLM)

- Next.js 16 route handlers receive `params` as a **Promise** (`const { code } = await ctx.params`).
- `ganache` doesn't always return decodable revert data for sends; the contract tests decode from several locations and use `.staticCall` for the replay check. Don't "simplify" it away.
- Never run `pkill -f "next start"` from a shell command that contains that text; it kills itself (exit 144). Use `fuser -k PORT/tcp`.
- If `npm run contract:test` can't find artifacts, run `npm run contract:compile` first (artifacts are git-ignored).
- The burner wallet is stored in `localStorage` (key `shakeproof-burner-key`). Clearing site data = new identity; use Passport → export/import key.
- Simulated mode is deliberate and visible (pink "simulated" pill). Don't present simulated txs as on-chain.
- Contract limits: one meet per wallet *pair*; Sybil resistance is out of scope (someone can use many wallets). Proximity is checked server-side from self-reported GPS, which is fine for a demo but spoofable.

## 11. Security notes

- Relayer key and any private key must stay out of git (`.env*` is ignored). Use a testnet-only key.
- The contract has no owner, no funds, and no upgrade path; the worst a relayer can do is refuse to submit.
- Signatures are bound to chain id, contract address, session id, both parties, quest id and a deadline, so they can't be replayed across chains/rooms.
