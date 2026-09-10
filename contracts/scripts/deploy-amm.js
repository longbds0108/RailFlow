const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Real Arc Testnet token addresses — mirrors frontend/lib/config.js.
const USDC = "0x3600000000000000000000000000000000000000";
const EURC = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";
const CIRBTC = "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF";

// Seed amounts limited by what the deployer wallet actually holds on
// testnet right now — only USDC/EURC gets real liquidity at deploy time.
// cirBTC pairs stay at 0 reserves (getAmountOut returns 0, no fake price)
// until the pool is topped up with cirBTC.
const SEED_USDC = process.env.SEED_USDC || "12";
const SEED_EURC = process.env.SEED_EURC || "10.37"; // ~12 / 1.157, matches the reference EURC/USDC rate

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) throw new Error("No signer configured — set DEPLOYER_PRIVATE_KEY in contracts/.env");
  console.log("Deployer:", deployer.address);

  const AMM = await hre.ethers.getContractFactory("RailFlowAMM");
  const amm = await AMM.deploy(deployer.address);
  await amm.waitForDeployment();
  const address = await amm.getAddress();
  const deployReceipt = await amm.deploymentTransaction().wait();
  console.log("RailFlowAMM deployed to:", address, "at block", deployReceipt.blockNumber);

  const usdc = await hre.ethers.getContractAt("IERC20", USDC);
  const eurc = await hre.ethers.getContractAt("IERC20", EURC);

  const usdcAmount = hre.ethers.parseUnits(SEED_USDC, 6);
  const eurcAmount = hre.ethers.parseUnits(SEED_EURC, 6);

  console.log(`Seeding USDC/EURC pair with ${SEED_USDC} USDC + ${SEED_EURC} EURC...`);
  await (await usdc.approve(address, usdcAmount)).wait();
  await (await eurc.approve(address, eurcAmount)).wait();
  await (await amm.seedLiquidity(USDC, EURC, usdcAmount, eurcAmount)).wait();
  console.log("Seeded.");

  const outPath = path.join(__dirname, "..", "deployed-amm.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        network: "arcTestnet",
        railFlowAmm: address,
        deployedAtBlock: deployReceipt.blockNumber,
        seededPairs: [{ tokenA: "USDC", tokenB: "EURC", amountA: SEED_USDC, amountB: SEED_EURC }],
        deployedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
  console.log("Wrote", outPath);
  console.log("\nNext: copy this into frontend/.env.local ->");
  console.log(`NEXT_PUBLIC_AMM_ADDRESS=${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
