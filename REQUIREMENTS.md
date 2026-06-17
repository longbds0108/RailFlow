# RailFlow — Required Information Checklist

Fill in every value below. Anything left as `<TODO>` blocks a fully-working build.
Stack: **Next.js + wagmi/viem (frontend) + Hardhat (contracts) + Node backend/indexer**.
Bridge: **real integration (Circle CCTP for USDC; cirBTC has no real bridge — see §7)**.

> Security note: use a DEDICATED testnet wallet for the deployer key. Never paste a real / mainnet private key.

---

## 1. Arc Testnet network
- Chain ID (decimal): `<TODO>`
- RPC URL: `<TODO>`
- Block explorer URL: `<TODO>`
- Network name: `<TODO>`
- Native gas token symbol: `<TODO>`
- Native gas token decimals: `<TODO>`
- Faucet URL (gas): `<TODO>`

## 2. Tokens (testnet)
| Token  | Contract address | Decimals | Faucet / mint method |
|--------|------------------|----------|----------------------|
| USDC   | `<TODO>`         | `<TODO>` | `<TODO>`             |
| EURC   | `<TODO>`         | `<TODO>` | `<TODO>`             |
| cirBTC | `<TODO>`         | `<TODO>` | `<TODO>`             |

## 3. Wallets & keys
- Deployer private key (dedicated testnet wallet): `<TODO>`  (or: I will deploy myself and give you addresses)
- Payment receiver wallet address: `<TODO>`
- Admin wallet address(es): `<TODO>`

## 4. Payment
- Demo packages:
  - `<name>` — `<price USDC>` — `<description>`
  - `<name>` — `<price USDC>` — `<description>`
- Pending order timeout (minutes): `<TODO>`
- Payment via: [ ] direct transfer  [ ] contract

## 5. Swap (AMM)
- Approach: [ ] A: build internal pool  [ ] B: integrate existing DEX (address: `<TODO>`)
- Swap fee (%): `<TODO>`
- Default slippage (%): `<TODO>`
- Initial liquidity per pool (USDC/EURC, USDC/cirBTC, EURC/cirBTC): `<TODO>`
- Who seeds liquidity: `<TODO>`

## 6. Staking
- APY (% demo) per token: USDC `<TODO>` / EURC `<TODO>` / cirBTC `<TODO>`
- Lock time: `<TODO>` (or none)
- Minimum stake amount: `<TODO>`
- Reward pool USDC amount + funder: `<TODO>`
- Reward formula: [ ] per-second linear  [ ] other: `<TODO>`

## 7. Bridge (REAL)
- Use Circle CCTP for USDC? [ ] yes  [ ] no
- Supported networks (pick pairs): [ ] Arc [ ] Eth Sepolia [ ] Base Sepolia [ ] Arbitrum Sepolia [ ] Polygon Amoy
- Per network — CCTP TokenMessenger address: `<TODO>`
- Per network — CCTP MessageTransmitter address: `<TODO>`
- Per network — CCTP domain ID: `<TODO>`
- Circle Attestation (Iris) API endpoint: `<TODO>`
- cirBTC decision: [ ] simulate  [ ] drop from bridge  [ ] real (protocol: `<TODO>`)
- EURC decision: [ ] CCTP (if supported) [ ] simulate  [ ] drop from bridge

## 8. Backend / Indexer / Database
- Database: [ ] PostgreSQL (conn string: `<TODO>`)  [ ] SQLite
- Indexer mode: [ ] poll RPC  [ ] websocket subscription
- Backend host: `<TODO>` (local / Railway / Render / VPS)

## 9. Admin dashboard
- Auth: [ ] Sign-In-With-Ethereum (admin wallet)  [ ] username/password
- Allowed admin addresses/users: `<TODO>`

## 10. Deployment & branding
- App name: `<TODO>`  (working title: "RailFlow")
- Logo / primary color: `<TODO>`
- Frontend host: [ ] Vercel  [ ] local only  — domain: `<TODO>`
- Disclaimer: use the EN/VI text from the plan (§12). Override: `<TODO>`
