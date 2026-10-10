# ShakeProof

ShakeProof creates a Monad testnet record after two people complete the meetup flow and sign the same handshake. The app never creates simulated transaction hashes; a completed handshake links to its confirmed transaction on MonadVision.

## Local setup

1. Install dependencies with `npm ci`.
2. Create a local config: `Copy-Item .env.example .env.local`.
3. In `.env.local`, set `RELAYER_PRIVATE_KEY` to a funded Monad testnet wallet. Keep this file private; it is git-ignored.
4. Compile and deploy the contract:

   ```powershell
   npm run contract:compile
   npm run contract:deploy
   ```

   The deploy command reads `.env.local` and saves the deployed contract address there.
5. Run `npm start`, then open [http://localhost:3001](http://localhost:3001). `npm start` builds the app before launching it.

Without a deployed contract, a valid contract address, and a funded relayer, signing returns a configuration or transaction error instead of pretending that a meet was recorded. After changing `.env.local`, restart the app so Next.js can rebuild with the updated public chain settings.

## Meetup flow

Create a room, have the second participant join by invite link or QR code, answer the icebreaker, share nearby location, and sign from both wallets. The relayer submits both signatures to the deployed contract; the confirmation transaction appears on MonadVision and in each passport.
