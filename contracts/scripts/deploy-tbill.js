const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const USDC = "0x3600000000000000000000000000000000000000";
const APY_BPS = 480; // 4.80%, matches the RWA page's "US T-Bill Note" illustrative yield
const SEED_RESERVE = process.env.SEED_TBILL_RESERVE || "0.5";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) throw new Error("No signer configured — set DEPLOYER_PRIVATE_KEY in contracts/.env");
  console.log("Deployer:", deployer.address);

  const TBill = await hre.ethers.getContractFactory("RailFlowTBill");
  const tbill = await TBill.deploy(deployer.address, USDC, APY_BPS);
  await tbill.waitForDeployment();
  const address = await tbill.getAddress();
  const deployReceipt = await tbill.deploymentTransaction().wait();
  console.log("RailFlowTBill deployed to:", address, "at block", deployReceipt.blockNumber);

  const usdc = await hre.ethers.getContractAt("IERC20", USDC);
  const amt = hre.ethers.parseUnits(SEED_RESERVE, 6);
  console.log(`Funding ${SEED_RESERVE} USDC redemption reserve...`);
  await (await usdc.approve(address, amt)).wait();
  await (await tbill.fundReserves(amt)).wait();

  const outPath = path.join(__dirname, "..", "deployed-tbill.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      { network: "arcTestnet", railFlowTBill: address, deployedAtBlock: deployReceipt.blockNumber, apyBps: APY_BPS, deployedAt: new Date().toISOString() },
      null,
      2
    )
  );
  console.log("Wrote", outPath);
  console.log("\nNext: copy this into frontend/.env.local ->");
  console.log(`NEXT_PUBLIC_TBILL_ADDRESS=${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
