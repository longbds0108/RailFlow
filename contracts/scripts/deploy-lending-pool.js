const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Real Arc Testnet token addresses — mirrors frontend/lib/config.js so the
// pool talks to the same tokens the rest of the app already reads balances
// from. Prices/LTVs mirror the Lend page's illustrative preview and the
// Swap page's reference prices, so the "real" and "demo" numbers agree.
const ASSETS = [
  {
    symbol: "USDC",
    address: process.env.USDC_ADDRESS || "0x3600000000000000000000000000000000000000",
    decimals: 6,
    priceWhole: 1, // 1 USDC = 1 USDC
    collateralFactorBps: 9000, // 90%, matches the Lend preview's USDC LTV
    borrowable: true,
  },
  {
    symbol: "EURC",
    address: process.env.EURC_ADDRESS || "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
    decimals: 6,
    priceWhole: 1.157, // matches the Swap page's reference EURC/USDC rate
    collateralFactorBps: 8500, // 85%, matches the Lend preview's EURC LTV
    borrowable: true,
  },
  {
    symbol: "cirBTC",
    address: process.env.CIRBTC_ADDRESS || "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF",
    decimals: 8,
    priceWhole: Number(process.env.COLLATERAL_PRICE || 65000), // matches the single-pair contract's default
    collateralFactorBps: 7000, // 70%, matches the Lend preview's cirBTC LTV
    borrowable: true,
  },
];

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    throw new Error("No signer configured — set DEPLOYER_PRIVATE_KEY in contracts/.env");
  }
  console.log("Deployer:", deployer.address);

  const Pool = await hre.ethers.getContractFactory("RailFlowLendingPool");
  const pool = await Pool.deploy(deployer.address);
  await pool.waitForDeployment();
  const address = await pool.getAddress();
  const deployTx = pool.deploymentTransaction();
  const deployReceipt = await deployTx.wait();
  const deployedAtBlock = deployReceipt.blockNumber;
  console.log("RailFlowLendingPool deployed to:", address, "at block", deployedAtBlock);

  for (const asset of ASSETS) {
    const price = hre.ethers.parseUnits(String(asset.priceWhole), 6); // priceInUsdc is always 6-decimal scaled
    console.log(`Listing ${asset.symbol} (${asset.address}) — price ${asset.priceWhole} USDC, LTV ${asset.collateralFactorBps / 100}%...`);
    const tx = await pool.listAsset(asset.address, asset.decimals, price, asset.collateralFactorBps, asset.borrowable);
    await tx.wait();
  }
  console.log("All assets listed.");

  const outPath = path.join(__dirname, "..", "deployed-pool.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        network: "arcTestnet",
        railFlowLendingPool: address,
        deployedAtBlock,
        assets: ASSETS.map(({ symbol, address: addr, decimals, priceWhole, collateralFactorBps, borrowable }) => ({
          symbol,
          address: addr,
          decimals,
          priceWhole,
          collateralFactorBps,
          borrowable,
        })),
        deployedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
  console.log("Wrote", outPath);
  console.log("\nNext: copy this into frontend/.env.local ->");
  console.log(`NEXT_PUBLIC_LENDING_POOL_ADDRESS=${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
