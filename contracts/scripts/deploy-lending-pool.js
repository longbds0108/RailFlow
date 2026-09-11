const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Real Arc Testnet token addresses — mirrors frontend/lib/config.js so the
// pool talks to the same tokens the rest of the app already reads balances
// from. Prices/LTVs mirror the Lend page's illustrative preview and the
// Swap page's reference prices, so the "real" and "demo" numbers agree.
// Interest rate curves follow Aave's classic kinked model: flat near 0%
// utilization, a moderate slope up to the "optimal" point, then a much
// steeper slope beyond it to pull utilization back down. cirBTC gets a
// lower optimal point and a much steeper excess slope, matching how
// volatile-collateral markets are usually configured more conservatively
// than stablecoin markets.
const ASSETS = [
  {
    symbol: "USDC",
    address: process.env.USDC_ADDRESS || "0x3600000000000000000000000000000000000000",
    decimals: 6,
    priceWhole: 1,
    collateralFactorBps: 9000,
    liquidationThresholdBps: 9300,
    liquidationBonusBps: 500,
    borrowable: true,
    rate: { baseRateBps: 0, optimalUtilizationBps: 8000, slope1Bps: 400, slope2Bps: 6000, reserveFactorBps: 1000 },
  },
  {
    symbol: "EURC",
    address: process.env.EURC_ADDRESS || "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
    decimals: 6,
    priceWhole: 1.157,
    collateralFactorBps: 8500,
    liquidationThresholdBps: 8800,
    liquidationBonusBps: 600,
    borrowable: true,
    rate: { baseRateBps: 0, optimalUtilizationBps: 8000, slope1Bps: 450, slope2Bps: 6500, reserveFactorBps: 1000 },
  },
  {
    symbol: "cirBTC",
    address: process.env.CIRBTC_ADDRESS || "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF",
    decimals: 8,
    priceWhole: Number(process.env.COLLATERAL_PRICE || 65000),
    collateralFactorBps: 7000,
    liquidationThresholdBps: 7500,
    liquidationBonusBps: 800,
    borrowable: true,
    rate: { baseRateBps: 0, optimalUtilizationBps: 4500, slope1Bps: 700, slope2Bps: 20000, reserveFactorBps: 2000 },
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
    const tx = await pool.listAsset(
      asset.address,
      asset.decimals,
      price,
      asset.collateralFactorBps,
      asset.liquidationThresholdBps,
      asset.liquidationBonusBps,
      asset.borrowable
    );
    await tx.wait();

    const r = asset.rate;
    console.log(`  Setting rate curve: base ${r.baseRateBps / 100}%, optimal ${r.optimalUtilizationBps / 100}%, slope1 ${r.slope1Bps / 100}%, slope2 ${r.slope2Bps / 100}%, reserve ${r.reserveFactorBps / 100}%...`);
    const rateTx = await pool.setInterestRateConfig(
      asset.address,
      r.baseRateBps,
      r.optimalUtilizationBps,
      r.slope1Bps,
      r.slope2Bps,
      r.reserveFactorBps
    );
    await rateTx.wait();
  }
  console.log("All assets listed and rate curves set.");

  const outPath = path.join(__dirname, "..", "deployed-pool.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        network: "arcTestnet",
        railFlowLendingPool: address,
        deployedAtBlock,
        assets: ASSETS.map(({ symbol, address: addr, decimals, priceWhole, collateralFactorBps, liquidationThresholdBps, liquidationBonusBps, borrowable, rate }) => ({
          symbol,
          address: addr,
          decimals,
          priceWhole,
          collateralFactorBps,
          liquidationThresholdBps,
          liquidationBonusBps,
          borrowable,
          rate,
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
