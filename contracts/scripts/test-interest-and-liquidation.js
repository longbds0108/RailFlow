// One-shot manual verification of the new interest-accrual + liquidation
// logic using the deployer wallet as a stand-in user, self-liquidating to
// exercise the liquidate() path without needing a second funded wallet.
// Not part of the app — a throwaway verification script for this session.
require("dotenv").config();
const { ethers } = require("ethers");
const path = require("path");

const provider = new ethers.JsonRpcProvider(process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network");
const user = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

const deployed = require(path.join(__dirname, "..", "deployed-pool.json"));
const artifact = require(path.join(__dirname, "..", "artifacts", "contracts", "RailFlowLendingPool.sol", "RailFlowLendingPool.json"));
const pool = new ethers.Contract(deployed.railFlowLendingPool, artifact.abi, user);

const EURC = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";
const erc20Abi = ["function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"];
const eurc = new ethers.Contract(EURC, erc20Abi, user);

function pct(bps) {
  return `${(Number(bps) / 100).toFixed(3)}%`;
}

async function main() {
  console.log("=== Step 1: supply + borrow to create real utilization ===");
  await (await eurc.approve(deployed.railFlowLendingPool, ethers.parseUnits("1000", 6))).wait();
  await (await pool.supply(EURC, ethers.parseUnits("10", 6))).wait();
  await (await pool.borrow(EURC, ethers.parseUnits("5", 6))).wait();

  const util1 = await pool.utilizationBps(EURC);
  const borrowRate1 = await pool.borrowRateBps(EURC);
  const supplyRate1 = await pool.supplyRateBps(EURC);
  console.log(`Utilization: ${pct(util1)} | borrow rate: ${pct(borrowRate1)}/yr | supply rate: ${pct(supplyRate1)}/yr`);
  // Expected at 50% utilization, optimal 80%, slope1 4.5%: 0 + 4.5%*50/80 = 2.8125%
  // Expected supply rate: 2.8125% * 50% * (1 - 10%) = 1.265625%

  const borrowedNow = await pool.borrowBalanceOf(user.address, EURC);
  const suppliedNow = await pool.supplyBalanceOf(user.address, EURC);
  console.log(`Borrowed: ${ethers.formatUnits(borrowedNow, 6)} EURC | Supplied: ${ethers.formatUnits(suppliedNow, 6)} EURC`);

  console.log("\n=== Step 2: wait ~70s, confirm real interest accrued ===");
  await new Promise((r) => setTimeout(r, 70_000));

  const borrowedAfter = await pool.borrowBalanceOf(user.address, EURC);
  const suppliedAfter = await pool.supplyBalanceOf(user.address, EURC);
  console.log(`Borrowed after wait: ${ethers.formatUnits(borrowedAfter, 6)} EURC (was ${ethers.formatUnits(borrowedNow, 6)})`);
  console.log(`Supplied after wait: ${ethers.formatUnits(suppliedAfter, 6)} EURC (was ${ethers.formatUnits(suppliedNow, 6)})`);
  console.log(borrowedAfter > borrowedNow ? "PASS: debt grew from interest" : "FAIL: debt did not grow");
  console.log(suppliedAfter > suppliedNow ? "PASS: supply balance grew from interest" : "FAIL: supply balance did not grow");

  console.log("\n=== Step 3: crash EURC price to force liquidation, then self-liquidate ===");
  const healthyBefore = !(await pool.isLiquidatable(user.address));
  console.log("Healthy before price crash:", healthyBefore);

  await (await pool.setPrice(EURC, ethers.parseUnits("0.5", 6))).wait();
  const liquidatableNow = await pool.isLiquidatable(user.address);
  console.log("Liquidatable after crashing EURC price to $0.50:", liquidatableNow);

  if (liquidatableNow) {
    const debtBefore = await pool.borrowBalanceOf(user.address, EURC);
    const collateralBefore = await pool.supplyBalanceOf(user.address, EURC);
    const repayAmount = ethers.parseUnits("1", 6);
    await (await eurc.approve(deployed.railFlowLendingPool, repayAmount)).wait();
    const tx = await pool.liquidate(user.address, EURC, EURC, repayAmount);
    const receipt = await tx.wait();
    const log = receipt.logs.map((l) => { try { return pool.interface.parseLog(l); } catch { return null; } }).find((l) => l?.name === "Liquidated");
    console.log("Liquidated event:", log ? { repaidAmount: ethers.formatUnits(log.args.repaidAmount, 6), collateralSeized: ethers.formatUnits(log.args.collateralSeized, 6) } : "not found");
    const debtAfter = await pool.borrowBalanceOf(user.address, EURC);
    const collateralAfter = await pool.supplyBalanceOf(user.address, EURC);
    console.log(`Debt: ${ethers.formatUnits(debtBefore, 6)} -> ${ethers.formatUnits(debtAfter, 6)}`);
    console.log(`Collateral: ${ethers.formatUnits(collateralBefore, 6)} -> ${ethers.formatUnits(collateralAfter, 6)}`);
    console.log(collateralBefore - collateralAfter > repayAmount ? "PASS: liquidator received a bonus over the repaid amount" : "FAIL: no bonus observed");
  } else {
    console.log("FAIL: price crash did not make the position liquidatable — skipping liquidate() call");
  }

  console.log("\n=== Step 4: restore EURC price (other pages read this live) ===");
  await (await pool.setPrice(EURC, ethers.parseUnits("1.157", 6))).wait();
  console.log("EURC price restored to 1.157.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
