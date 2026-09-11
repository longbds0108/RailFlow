// RailFlow debt-guardrail agent keeper.
//
// This is the standalone process behind the Agent page's "manage borrow
// level" mandate: it runs the full loop the user asked for — read position →
// check condition → check budget/authority → execute → confirm → log reason
// — completely on its own, using a dedicated wallet that never touches user
// funds directly (it only pulls what a user's own on-chain mandate lets it
// pull, and the contract itself enforces the threshold/limit/reserve/expiry
// on every call).
//
// Usage:
//   node scripts/agent-keeper.js            # run forever, checking every POLL_INTERVAL_MS
//   node scripts/agent-keeper.js --once      # single pass, then exit (for testing/demo)
//
// This process must be RUNNING somewhere for the mandate to actually act
// while you're away — a laptop left open, a small VM, or a scheduled job
// (e.g. a cron-triggered GitHub Action) all work. It holds no funds beyond
// the small amount of Arc gas needed to submit its own transactions.

require("dotenv").config();
const { ethers } = require("ethers");
const path = require("path");
const fs = require("fs");

const RPC_URL = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network";
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;
const POLL_INTERVAL_MS = Number(process.env.AGENT_POLL_INTERVAL_MS || 60_000);
const BPS_DENOMINATOR = 10_000n;
// Repay down to a couple points under the threshold rather than skimming it
// exactly, so one action clears the trigger instead of re-firing next poll.
const TARGET_BUFFER_BPS = 200n;

if (!AGENT_PRIVATE_KEY) {
  throw new Error("Set AGENT_PRIVATE_KEY in contracts/.env — generate one with a fresh ethers.Wallet, never reuse the deployer key.");
}

const deployedPath = path.join(__dirname, "..", "deployed-pool.json");
const deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
const POOL_ADDRESS = deployed.railFlowLendingPool;

const artifact = require(path.join(__dirname, "..", "artifacts", "contracts", "RailFlowLendingPool.sol", "RailFlowLendingPool.json"));
const poolAbi = artifact.abi;

const erc20Abi = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const agentWallet = new ethers.Wallet(AGENT_PRIVATE_KEY, provider);
const pool = new ethers.Contract(POOL_ADDRESS, poolAbi, agentWallet);

function log(...args) {
  console.log(`[agent-keeper ${new Date().toISOString()}]`, ...args);
}

// Every address that has ever called setRepayMandate — current state (active,
// agent, limits) is always re-read fresh from the contract, this is purely
// for discovery so we don't need a database to know who to check. Arc's RPC
// prunes old history, so this queries from the pool's own deployment block
// rather than genesis (a full-range eth_getLogs call gets rejected outright).
async function discoverMandateUsers() {
  const filter = pool.filters.MandateSet();
  const fromBlock = deployed.deployedAtBlock ?? 0;
  const events = await pool.queryFilter(filter, fromBlock, "latest");
  return [...new Set(events.map((e) => e.args.user))];
}

async function checkAndActOnUser(user) {
  const status = await pool.mandateStatus(user);
  const [agent, repayToken, thresholdBps, dailyLimit, spentToday, reserveAmount, expiresAt, active, currentUtilizationBps] = status;

  if (!active) return log(user, "— mandate inactive, skipping");
  if (agent.toLowerCase() !== agentWallet.address.toLowerCase()) return log(user, "— mandate assigns a different agent, skipping");
  if (BigInt(expiresAt) * 1000n < BigInt(Date.now())) return log(user, "— mandate expired, skipping");
  if (BigInt(currentUtilizationBps) <= BigInt(thresholdBps)) {
    return log(user, `— utilization ${bpsToPct(currentUtilizationBps)} is within the ${bpsToPct(thresholdBps)} threshold, no action needed`);
  }

  log(user, `— utilization ${bpsToPct(currentUtilizationBps)} exceeds threshold ${bpsToPct(thresholdBps)}, evaluating a repay`);

  const remainingBudget = BigInt(dailyLimit) - BigInt(spentToday);
  if (remainingBudget <= 0n) {
    return log(user, "  blocked: today's daily budget is used up — ask the user to raise the limit or wait for tomorrow's window");
  }

  const token = new ethers.Contract(repayToken, erc20Abi, provider);
  // borrowBalanceOf returns the real, currently-accrued debt (principal +
  // interest so far) — userAssets() alone would only give the raw scaled
  // storage value now that debt compounds via a per-asset index.
  const [walletBalance, allowance, [collateralValue, borrowValue], borrowed, assetCfg] = await Promise.all([
    token.balanceOf(user),
    token.allowance(user, POOL_ADDRESS),
    pool.accountData(user),
    pool.borrowBalanceOf(user, repayToken),
    pool.assets(repayToken),
  ]);

  if (borrowed === 0n) return log(user, "  blocked: no outstanding debt in the mandate's repay token");

  const maxByReserve = walletBalance > BigInt(reserveAmount) ? walletBalance - BigInt(reserveAmount) : 0n;
  if (maxByReserve <= 0n) {
    return log(user, "  blocked: wallet balance is at or below the reserve — ask the user to top up or lower the reserve");
  }
  if (allowance === 0n) {
    return log(user, "  blocked: no USDC allowance granted to the pool — ask the user to approve before the mandate can pull funds");
  }

  // Target: bring borrow value down to (threshold - buffer) of collateral value.
  const targetBps = BigInt(thresholdBps) > TARGET_BUFFER_BPS ? BigInt(thresholdBps) - TARGET_BUFFER_BPS : 0n;
  const targetBorrowValue = (BigInt(collateralValue) * targetBps) / BPS_DENOMINATOR;
  const excessValue = BigInt(borrowValue) - targetBorrowValue;
  if (excessValue <= 0n) return log(user, "  blocked: computed repay amount is zero, skipping");

  const priceInUsdc = assetCfg.priceInUsdc;
  const decimals = assetCfg.decimals;
  const amountByExcess = (excessValue * 10n ** BigInt(decimals)) / BigInt(priceInUsdc);

  let amount = [amountByExcess, remainingBudget, maxByReserve, allowance, borrowed].reduce((a, b) => (a < b ? a : b));
  if (amount <= 0n) return log(user, "  blocked: no repayable amount after applying limits, skipping");

  log(user, `  executing agentRepay: ${ethers.formatUnits(amount, decimals)} of token ${repayToken}`);
  try {
    const tx = await pool.agentRepay(user, amount);
    log(user, `  tx sent: ${tx.hash}`);
    const receipt = await tx.wait();
    log(user, `  confirmed in block ${receipt.blockNumber} — position and reasoning recorded on-chain via AgentRepaid`);
  } catch (err) {
    log(user, `  FAILED: ${err.shortMessage || err.message}`);
  }
}

function bpsToPct(bps) {
  return `${(Number(bps) / 100).toFixed(1)}%`;
}

async function runOnce() {
  log("Agent wallet:", agentWallet.address, "· pool:", POOL_ADDRESS);
  const users = await discoverMandateUsers();
  if (users.length === 0) {
    log("No mandates found yet.");
    return;
  }
  log(`Checking ${users.length} user(s) with a mandate on record...`);
  for (const user of users) {
    await checkAndActOnUser(user);
  }
}

async function main() {
  const once = process.argv.includes("--once");
  if (once) {
    await runOnce();
    return;
  }
  log(`Starting continuous loop, polling every ${POLL_INTERVAL_MS / 1000}s. Ctrl+C to stop.`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await runOnce();
    } catch (err) {
      log("Poll cycle failed:", err.message);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
