# ArcFlow Backend

Express REST API + SQLite store + read-only viem verifier + SIWE admin auth for the ArcFlow testnet dApp (Arc Testnet, chainId `5042002`).

The backend never holds a private key. It verifies user-submitted transaction hashes on-chain (read-only) and records state.

## Run

```bash
npm install
npm start      # node src/index.js
npm run dev    # node --watch src/index.js (auto-reload)
```

Server listens on `http://localhost:${PORT}` (default `4000`).

- Shared chain/token config is read from `../config/arc.json`.
- Staking address is read from `../config/deployed.json` (optional; `stakingAddress` is `null` until staking is deployed).
- The SQLite file is created at `backend/data/arcflow.sqlite` (the `data/` dir is created on boot).

## Environment (`../.env`, loaded via dotenv)

| Var | Purpose |
| --- | --- |
| `PORT` | HTTP port (default `4000`) |
| `DATABASE_PATH` | SQLite path relative to `backend/` (default `./data/arcflow.sqlite`) |
| `SESSION_SECRET` | Cookie session signing secret |
| `ADMIN_ADDRESSES` | Comma-separated admin addresses allowed to sign in via SIWE |
| `PAYMENT_RECEIVER_ADDRESS` | Address that must receive the USDC payment (falls back to `arc.json` payment.receiver) |
| `FRONTEND_ORIGIN` | CORS origin (default `http://localhost:3000`) |

Secrets are never logged or returned by any endpoint.

## Endpoints (base `http://localhost:4000`)

### Public
- `GET /api/health` -> `{ ok: true }`
- `GET /api/config` -> safe config subset (network, tokens, packages, staking/swap/bridge params, disclaimer) + `stakingAddress`
- `POST /api/orders` `{ packageId, buyer }` -> creates a `pending` order
- `GET /api/orders/:id` -> order with current status (auto-expires past timeout)
- `POST /api/orders/:id/pay` `{ txHash }` -> verifies the USDC transfer on-chain; sets `paid` or `failed`
- `GET /api/history?address=0x..` -> unified payments/swaps/stakes/bridges, newest first
- `POST /api/swaps` `{ address, tokenIn, tokenOut, amountIn, amountOut, txHash }`
- `POST /api/bridges` `{ address, fromChain, toChain, token, amount, srcTxHash }`
- `POST /api/stakes` `{ address, action, token, amount, txHash }` (action: `stake|unstake|claim`)

Record endpoints confirm the tx receipt succeeded on-chain before marking `success`/`completed`; otherwise stored as `failed` (or `pending_source` for an unconfirmed bridge source).

### Admin (SIWE; restricted to `ADMIN_ADDRESSES`)
- `GET /api/admin/nonce?address=` -> `{ nonce }`
- `POST /api/admin/verify` `{ message, signature }` -> sets session cookie
- `POST /api/admin/logout`
- `GET /api/admin/overview` -> aggregate totals
- `GET /api/admin/payments | /swaps | /staking | /bridges` -> full tables

## Statuses (per SPEC)
- Payment: `pending, processing, paid, failed, expired, cancelled`
- Swap: `draft, waiting_approval, waiting_signature, processing, success, failed`
- Staking: `no_stake, active, claimable, unstaking, completed, failed`
- Bridge: `pending_source, source_confirmed, waiting_bridge, destination_processing, completed, failed`

## Payment verification
On `POST /api/orders/:id/pay` the backend fetches the tx receipt via viem on Arc Testnet and requires:
- receipt status `success`,
- an ERC-20 `Transfer(address,address,uint256)` log from USDC (`0x3600000000000000000000000000000000000000`) to the payment receiver for `>=` the order amount (6 decimals),
- the txHash not already used (UNIQUE),
- the order still `pending` and not expired (`orderTimeoutMinutes`).
