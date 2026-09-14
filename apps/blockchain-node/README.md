# timecoin-node

A real, from-scratch Bitcoin-style blockchain for TimeCoin: SHA-256d proof-of-work
mining, secp256k1 wallets, a UTXO ledger, block reward halving, and Bitcoin's
difficulty-retarget algorithm — same fundamentals, different name, no
copy-protection on Bitcoin's ideas to worry about.

This is **not** deployable as a Vercel serverless function. Mining and the chain
state need a long-running process (serverless invocations don't persist memory
between requests and can't hold a multi-second PoW loop). Run it locally for now;
later it can go on a small persistent host (a VPS, Railway, Fly.io) reachable by
`apps/web`'s wallet page.

## Run it

```bash
npm install
npm run dev        # http://localhost:3001, devnet by default
```

The chain persists to `data/chain.json` (gitignored) and reloads on restart.

## Env vars

- `TIMECOIN_NETWORK` — `devnet` (default, seconds-scale blocks/difficulty for local testing) or `mainnet` (Bitcoin's real numbers: 10-minute blocks, 210,000-block halving, 2016-block retarget).
- `PORT` — HTTP port (default `3001`).
- `TIMECOIN_DATA_PATH` — override the snapshot file path.
- `TIMECOIN_AUTOMINE_MS` + `TIMECOIN_AUTOMINE_ADDRESS` — if set, the node mines to that address on an interval instead of waiting for `/mine` calls (handy for keeping a devnet chain moving while you test the wallet UI).

## HTTP API

- `GET /status` — network, height, difficulty, next reward, supply, mempool size.
- `GET /balance/:address`
- `GET /utxos/:address` — spendable UTXOs (coinbase outputs excluded until they mature).
- `GET /chain?limit=20` — most recent blocks.
- `GET /mempool`
- `POST /tx` — submit a signed transaction (built and signed client-side; the node never sees private keys).
- `POST /mine` — `{ minerAddress, maxAttempts? }`, runs the PoW loop synchronously and returns the mined block, or `408` if `maxAttempts` runs out first.

## What's deliberately out of scope for now

- P2P networking / multiple nodes gossiping blocks to each other (`Blockchain.replaceChainIfBetter` implements the longest-valid-chain fork-choice rule so this can be added later without changing the core).
- A fee market (transactions are zero-fee on devnet).
- Any production deployment story for the node process itself.
