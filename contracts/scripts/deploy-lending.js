const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Defaults mirror frontend/lib/config.js so the contract talks to the same
// real cirBTC/USDC tokens the rest of the app already reads balances from.
const COLLATERAL_TOKEN = process.env.CIRBTC_ADDRESS || "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF"; // cirBTC
const BORROW_TOKEN = process.env.USDC_ADDRESS || "0x3600000000000000000000000000000000000000"; // USDC

// No price oracle on testnet (see contract-level dev note) — this is an
// owner-set illustrative rate, scaled to the borrow token's decimals.
// Defaults to 65,000 USDC per cirBTC, matching the Swap page's reference price.
const COLLATERAL_PRICE_WHOLE = Number(process.env.COLLATERAL_PRICE || 65000);

// Optional: USDC amount to seed the pool with immediately after deploy, so
// the contract can actually pay out loans (the deployer wallet must already
// hold this much USDC). Leave FUND_AMOUNT unset to skip this step.
const FUND_AMOUNT_WHOLE = process.env.FUND_AMOUNT ? Number(process.env.FUND_AMOUNT) : null;

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    throw new Error("No signer configured — set DEPLOYER_PRIVATE_KEY in contracts/.env");
  }
  console.log("Deployer:", deployer.address);

  const borrowTokenContract = await hre.ethers.getContractAt("IERC20Metadata", BORROW_TOKEN);
  const borrowDecimals = await borrowTokenContract.decimals();
  const collateralPrice = hre.ethers.parseUnits(String(COLLATERAL_PRICE_WHOLE), borrowDecimals);

  console.log("Collateral token (cirBTC):", COLLATERAL_TOKEN);
  console.log("Borrow token (USDC):", BORROW_TOKEN);
  console.log(`Collateral price: ${COLLATERAL_PRICE_WHOLE} USDC per cirBTC`);

  const LendingBorrowing = await hre.ethers.getContractFactory("LendingBorrowing");
  const lending = await LendingBorrowing.deploy(COLLATERAL_TOKEN, BORROW_TOKEN, collateralPrice, deployer.address);
  await lending.waitForDeployment();
  const address = await lending.getAddress();
  console.log("LendingBorrowing deployed to:", address);

  if (FUND_AMOUNT_WHOLE) {
    const amount = hre.ethers.parseUnits(String(FUND_AMOUNT_WHOLE), borrowDecimals);
    console.log(`Funding pool with ${FUND_AMOUNT_WHOLE} USDC...`);
    const approveTx = await borrowTokenContract.connect(deployer).approve(address, amount);
    await approveTx.wait();
    const fundTx = await lending.fundPool(amount);
    await fundTx.wait();
    console.log("Pool funded.");
  } else {
    console.log("Skipped pool funding (set FUND_AMOUNT in contracts/.env to seed USDC liquidity).");
  }

  const outPath = path.join(__dirname, "..", "deployed.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        network: "arcTestnet",
        lendingBorrowing: address,
        collateralToken: COLLATERAL_TOKEN,
        borrowToken: BORROW_TOKEN,
        collateralPriceWhole: COLLATERAL_PRICE_WHOLE,
        deployedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
  console.log("Wrote", outPath);
  console.log("\nNext: copy this into frontend/.env.local ->");
  console.log(`NEXT_PUBLIC_LENDING_ADDRESS=${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
