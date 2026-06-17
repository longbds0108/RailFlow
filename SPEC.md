# RailFlow — Integration Spec (single source of truth)

Testnet demo dApp on **Arc Testnet** (Circle's chain). Four modules: **Payment, Swap, Staking, Bridge**, plus user **History** and an **Admin dashboard**. Everything in **English**.

Core principle: **self-custody**. The browser app never holds a private key; the user signs every transaction in MetaMask. The backend only verifies on-chain transactions and records state. The operator/deployer private key is used **only** by the contracts package (deploy + fund staking) and the indexer (read-only) — never in the frontend.

## Architecture
- `config/arc.json` — shared chain/token/module config (read by all packages).
- `config/deployed.json` — written by the contracts deploy script; holds `{ "staking": "0x..." }`. Backend & frontend read it at runtime (may be absent until staking is deployed → treat staking as "not deployed yet").
- `contracts/` — Hardhat (JS). One custom contract: `ArcStaking`. Swap/Bridge/Payment need **no** custom contracts (handled by Circle App Kit / direct transfer).
- `backend/` — Node + Express + SQLite. REST API + on-chain indexer/verifier + SIWE admin auth.
- `frontend/` — Next.js (App Router) + wagmi/viem + Circle App Kit.

## Circle App Kit usage (frontend, browser)
Packages: `@circle-fin/app-kit`, `@circle-fin/adapter-viem-v2`, `viem`, `wagmi`.
Browser adapter (user signs in MetaMask) — use `createViemAdapterFromProvider` over the wallet's EIP-1193 provider (from wagmi connector / `window.ethereum`), NOT the private-key adapter.
```ts
import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
const kit = new AppKit();
const adapter = createViemAdapterFromProvider({ provider: window.ethereum });
// PAYMENT
await kit.send({ from: { adapter, chain: "Arc_Testnet" }, to: RECEIVER, amount: "1.00", token: "USDC", config: { kitKey: KIT_KEY } });
// SWAP (same chain)
await kit.swap({ from: { adapter, chain: "Arc_Testnet" }, tokenIn: "EURC", tokenOut: "USDC", amountIn: "1.00", config: { kitKey: KIT_KEY } });
// BRIDGE (cross chain, CCTP)
await kit.bridge({ from: { adapter, chain: "Ethereum_Sepolia" }, to: { adapter, chain: "Arc_Testnet" }, amount: "1.00", token: "USDC", config: { kitKey: KIT_KEY } });
```
Kit key from `process.env.NEXT_PUBLIC_KIT_KEY`. After any tx returns a hash, the frontend POSTs it to the backend to record + verify (see API). If an App Kit method signature differs slightly at runtime, adapt to the installed package's actual types — keep the chain names and token symbols above.

## Backend REST API (base `http://localhost:4000`)
All list/detail responses JSON. CORS open to the frontend origin.

Public:
- `GET /api/health` → `{ ok: true }`
- `GET /api/config` → safe subset of arc.json (network, tokens, packages, staking params, bridge chains, disclaimer) + `{ stakingAddress }` from deployed.json (or null).
- `POST /api/orders` `{ packageId, buyer }` → creates a **pending** order `{ id, packageId, amount, receiver, status:"pending", expiresAt }`.
- `GET /api/orders/:id` → order with current status.
- `POST /api/orders/:id/pay` `{ txHash }` → backend verifies the USDC transfer on Arc (correct receiver, amount, token, success, tx not reused, not expired) → sets status `paid` or `failed`. Returns updated order.
- `GET /api/history?address=0x..` → unified list of that address's payments, swaps, stakes, bridges (newest first).
- Record endpoints (frontend reports a tx after App Kit returns; backend verifies on-chain & stores):
  - `POST /api/swaps` `{ address, tokenIn, tokenOut, amountIn, amountOut, txHash }`
  - `POST /api/bridges` `{ address, fromChain, toChain, token, amount, srcTxHash }`
  - `POST /api/stakes` `{ address, action, token, amount, txHash }` (action: stake|unstake|claim)

Admin (SIWE-protected; only `ADMIN_ADDRESSES`):
- `GET /api/admin/nonce?address=` → `{ nonce }`
- `POST /api/admin/verify` `{ message, signature }` → sets session cookie; rejects non-admin.
- `POST /api/admin/logout`
- `GET /api/admin/overview` → totals: users (distinct addresses), tx count, total paid, swap count/volume, total staked, total rewards claimed, bridge pending/completed counts.
- `GET /api/admin/payments | /swaps | /staking | /bridges` → full tables per plan §7.

### Order/tx statuses (from plan §8)
- Payment: pending, processing, paid, failed, expired, cancelled
- Swap: draft, waiting_approval, waiting_signature, processing, success, failed
- Staking: no_stake, active, claimable, unstaking, completed, failed
- Bridge: pending_source, source_confirmed, waiting_bridge, destination_processing, completed, failed

## Indexer/verifier (backend)
Uses `viem` public client on Arc RPC (read-only). Verifies tx receipts for payments (ERC-20 Transfer log to receiver, correct amount/token, status success), de-dupes by txHash (unique constraint). Poll mode. For swap/bridge/stake records, confirm the tx hash exists & succeeded on-chain before marking success.

## ArcStaking contract (contracts/)
Solidity ^0.8.24. Stake an ERC-20 (USDC or EURC), earn **USDC** rewards at a fixed APY (config `staking.apyBps`), optional lock (`lockSeconds`, default 0), `minStake`. Functions: `stake(token, amount)`, `unstake(token, amount)`, `claim(token)`, view `pendingReward(user, token)`, `stakeInfo(user, token)`. Owner funds a reward pool (USDC) and sets APY. Emits `Staked`, `Unstaked`, `Claimed` events (indexer-friendly). Deploy script: deploy, then transfer `staking.rewardPoolFund` USDC into the contract as rewards, then write address to `config/deployed.json`. Reward = principal * apyBps/10000 * elapsed / 365d, linear per-second.

## Env (see .env)
Secrets: DEPLOYER_PRIVATE_KEY, KIT_KEY, CIRCLE_API_KEY, ADMIN_ADDRESSES, PAYMENT_RECEIVER_ADDRESS, SESSION_SECRET.
Public: NEXT_PUBLIC_ARC_CHAIN_ID, NEXT_PUBLIC_ARC_RPC_URL, NEXT_PUBLIC_ARC_EXPLORER_URL, NEXT_PUBLIC_APP_NAME, NEXT_PUBLIC_KIT_KEY, NEXT_PUBLIC_API_BASE, NEXT_PUBLIC_PAYMENT_RECEIVER.

## UX must-haves
- Connect MetaMask; detect wrong network and offer "Switch to Arc Testnet" (add chain params from config).
- Wallet states: no MetaMask, not connected, wrong network, no testnet tokens, ready.
- Persistent **testnet disclaimer** banner (use config.disclaimer.en).
- Every action shows a preview before signing (token, amount, network, fee/slippage, reward, testnet warning) and a result with an explorer link (`${explorerUrl}/tx/${hash}`).
- cirBTC: balance hidden (no address); still selectable in swap by symbol.
