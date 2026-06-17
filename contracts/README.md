# ArcFlow Contracts

Hardhat (JavaScript) package for the ArcFlow demo on **Arc Testnet**. Contains a
single custom contract, `ArcStaking`, plus a deploy script and tests.

## ArcStaking

Stake an allowed ERC-20 (USDC or EURC) and earn **USDC** rewards at a fixed APY
with linear per-second accrual:

```
reward = principal * apyBps / 10000 * elapsed / 365 days
```

- Allowed stake tokens, APY (`apyBps`), optional `lockSeconds`, and `minStake`
  are owner-configurable.
- Owner funds/withdraws the USDC reward pool (`fundRewardPool` /
  `withdrawRewardPool`).
- Uses OpenZeppelin `Ownable`, `SafeERC20`, and `ReentrancyGuard`.
- Events: `Staked`, `Unstaked`, `Claimed` (indexer-friendly, indexed `user` & `token`).

### Decimals / value assumption (demo)

USDC and EURC both use 6 decimals, and the reward token (USDC) is 6 decimals.
Rewards are computed directly from the staked principal's smallest units and paid
in USDC smallest units, assuming **1:1 token value** between every stakable token
and USDC. This is fine for a testnet demo since all tokens share 6 decimals; a
production system would price each token via an oracle. See the comment in
`contracts/ArcStaking.sol`.

## Setup

```bash
cd contracts
npm install
```

Secrets are read from the repo-root `../.env` (loaded by `hardhat.config.js` via
`dotenv`). The deployer key is `DEPLOYER_PRIVATE_KEY`. Never commit `.env`.

## Compile

```bash
npx hardhat compile
```

## Test

Runs on the in-process Hardhat network using a mock ERC-20 (no live network):

```bash
npx hardhat test
```

## Deploy (Arc Testnet)

Deploys `ArcStaking` (reward token = USDC, `apyBps=1000`, `lockSeconds=0`,
`minStake=1 USDC`), allows USDC & EURC, funds the reward pool with
`staking.rewardPoolFund` (10 USDC) from the deployer, then writes the address to
`../config/deployed.json`:

```bash
npx hardhat run scripts/deploy.js --network arcTestnet
```

The script logs the deployed address and an explorer link
(`https://testnet.arcscan.app/address/<addr>`).
```
