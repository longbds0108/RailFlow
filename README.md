# ArcFlow

Testnet demo dApp on **Arc Testnet** (Circle's chain). Four modules — **Payment, Swap, Staking, Bridge** — plus user **History** and an **Admin dashboard**. Self-custody: the browser never holds a private key; the user signs every transaction in MetaMask. The backend only verifies on-chain transactions and records state.

> ⚠️ Testnet only. All tokens (USDC, EURC, cirBTC) have no real value. Not a payment service, exchange, investment, or yield product.

## Stack
- **contracts/** — Hardhat (JS). One custom contract `ArcStaking` (USDC rewards, fixed APY). Deployed to Arc Testnet.
- **backend/** — Node (ESM) + Express + SQLite. REST API, on-chain payment verifier, SIWE admin auth.
- **frontend/** — Next.js (App Router) + wagmi/viem + Circle App Kit (`kit.send` / `kit.swap` / `kit.bridge`).
- **config/arc.json** — shared chain/token/module config · **config/deployed.json** — deployed staking address.

Swap, Bridge and Payment use Circle App Kit (no custom contracts). Staking is the only custom Solidity contract.

## Prerequisites
- Node.js (LTS 20/22 recommended for the Hardhat deploy; the app runs on 25).
- MetaMask in the browser.
- Secrets already wired in `.env` (gitignored). Operator wallet `0xF964…6a57` funded with testnet USDC/EURC from https://faucet.circle.com.

## Deployed
- Network: Arc Testnet · chainId **5042002** · RPC `https://rpc.testnet.arc.network` · explorer `https://testnet.arcscan.app`
- ArcStaking: `0x6e79287f62B47307B5b7349072c51AdAF8833d54` (reward pool funded 10 USDC)

## Run (local, 2 terminals)
```bash
# 1) Backend  →  http://localhost:4000
cd backend && npm install && npm start

# 2) Frontend →  http://localhost:3000
cd frontend && npm install && npm run dev
```
Open http://localhost:3000, connect MetaMask, switch to Arc Testnet when prompted.

## Re-deploy / fund staking (optional)
```bash
cd contracts && npm install
npx hardhat test                                   # local tests
npx hardhat run scripts/deploy.js --network arcTestnet
```
The deploy script writes the new address to `config/deployed.json`, which backend & frontend pick up automatically.

## Run with Docker (local)
```bash
docker compose up -d --build      # backend :4000, frontend :3000
docker compose ps                 # status
docker compose logs -f            # logs
docker compose down               # stop
```
Secrets are injected into the backend at runtime via `env_file: .env`; the frontend image only contains `NEXT_PUBLIC_*` (no private key). SQLite persists in the `backend-data` volume.

## Expose at arcflow.click (Cloudflare Tunnel — no VPS)
Domain is on Cloudflare. `cloudflared` config + helper are in `deploy/`.
```bash
cloudflared tunnel login          # interactive: pick the arcflow.click zone
./deploy/tunnel-setup.sh          # creates tunnel + DNS (arcflow.click, www, api.arcflow.click)
cloudflared tunnel run arcflow    # start; or: sudo cloudflared service install (run on boot)
```
Routing: `arcflow.click` → frontend `:3000`, `api.arcflow.click` → backend `:4000` (HTTPS auto).
The frontend is built with `NEXT_PUBLIC_API_BASE=https://api.arcflow.click` and the backend CORS allows `https://arcflow.click` (both via `.env`). If you change these, rebuild the frontend image (`docker compose up -d --build frontend`).

## Admin
Sign in at `/admin` with an `ADMIN_ADDRESSES` wallet (default: the operator wallet) via Sign-In-With-Ethereum.

## Config you may want to tweak (`config/arc.json`)
Payment packages & timeout, staking APY/lock/min, bridge supported chains, swap pairs/slippage, disclaimer text.

## Known limitations
- **cirBTC** has no valid ERC-20 address on Arc Testnet → its balance is hidden; it remains selectable as a swap symbol (App Kit may reject it at runtime, in which case the error surfaces to the user).
- Bridge completion (CCTP attestation) is asynchronous; the backend records source confirmation but does not poll destination mint to `completed` (would need a CCTP poller).
- Reward math assumes 1:1 token value across USDC/EURC (documented in the contract) — fine for a demo.
