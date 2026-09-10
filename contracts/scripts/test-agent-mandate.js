// One-shot manual test of the full debt-guardrail loop using the deployer
// wallet as a stand-in "user": supply collateral, borrow past a threshold,
// grant a mandate to the agent wallet, then let the real keeper (run
// separately) pick it up and execute a real agentRepay. Not part of the app
// — a throwaway verification script for this session.
require("dotenv").config();
const { ethers } = require("ethers");
const path = require("path");

const provider = new ethers.JsonRpcProvider(process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network");
const user = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

const deployed = require(path.join(__dirname, "..", "deployed-pool.json"));
const artifact = require(path.join(__dirname, "..", "artifacts", "contracts", "RailFlowLendingPool.sol", "RailFlowLendingPool.json"));
const pool = new ethers.Contract(deployed.railFlowLendingPool, artifact.abi, user);

const erc20Abi = [
  "function approve(address,uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
];

const CIRBTC = "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF";
const USDC = "0x3600000000000000000000000000000000000000";
const AGENT_ADDRESS = "0x9d73b0915b163546f6c2dE111B59599F16548157";

async function main() {
  const cirbtc = new ethers.Contract(CIRBTC, erc20Abi, user);
  const usdc = new ethers.Contract(USDC, erc20Abi, user);

  const cirbtcBal = await cirbtc.balanceOf(user.address);
  console.log("cirBTC wallet balance:", ethers.formatUnits(cirbtcBal, 8));
  if (cirbtcBal > 0n) {
    console.log("Approving + supplying all cirBTC as collateral...");
    await (await cirbtc.approve(deployed.railFlowLendingPool, cirbtcBal)).wait();
    await (await pool.supply(CIRBTC, cirbtcBal)).wait();
  } else {
    console.log("No cirBTC left in wallet — already supplied in an earlier run, skipping.");
  }

  // This is a brand-new pool with no other suppliers, so USDC *liquidity* is
  // the binding constraint, not collateral capacity — supply some USDC too
  // (it also counts as extra collateral) so there's something to borrow.
  const usdcSupply = ethers.parseUnits("10", 6);
  console.log("Approving + supplying 10 USDC (adds liquidity + collateral)...");
  await (await usdc.approve(deployed.railFlowLendingPool, usdcSupply)).wait();
  await (await pool.supply(USDC, usdcSupply)).wait();

  const poolUsdcBalance = await usdc.balanceOf(deployed.railFlowLendingPool);
  console.log("Pool USDC liquidity:", ethers.formatUnits(poolUsdcBalance, 6));

  console.log("Borrowing all available USDC liquidity...");
  await (await pool.borrow(USDC, poolUsdcBalance)).wait();

  const [collateralValue, borrowValue] = await pool.accountData(user.address);
  const utilBps = (borrowValue * 10000n) / collateralValue;
  console.log("Utilization now:", (Number(utilBps) / 100).toFixed(2) + "%");

  console.log("Approving USDC for the pool to pull on agentRepay...");
  const usdcBalNow = await usdc.balanceOf(user.address);
  await (await usdc.approve(deployed.railFlowLendingPool, usdcBalNow * 10n)).wait();

  const thresholdBps = 2000; // 20%
  const dailyLimit = ethers.parseUnits("10", 6); // 10 USDC/day
  const reserveAmount = ethers.parseUnits("1", 6); // keep at least 1 USDC in wallet
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

  console.log(`Setting mandate: threshold ${thresholdBps / 100}%, daily limit 10 USDC, reserve 1 USDC, expires in 30 days...`);
  await (await pool.setRepayMandate(AGENT_ADDRESS, USDC, thresholdBps, dailyLimit, reserveAmount, expiresAt)).wait();

  console.log(`\nMandate is live. Utilization is above ${thresholdBps / 100}%, so the next \`npm run agent:keeper:once\` should execute a real agentRepay.`);
  console.log("User (test) address:", user.address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
