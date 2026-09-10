const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const USDC = "0x3600000000000000000000000000000000000000";
const EURC = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";
const CIRBTC = "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF";

// Matches the Yield page's illustrative vaults exactly, so the "real" and
// "demo" numbers agree: name, APY and lock period per vault.
const VAULTS = [
  { name: "Stable Yield", symbol: "USDC", address: USDC, apyBps: 840, lockDays: 14, decimals: 6 },
  { name: "Euro Yield", symbol: "EURC", address: EURC, apyBps: 630, lockDays: 7, decimals: 6 },
  { name: "cirBTC staking", symbol: "cirBTC", address: CIRBTC, apyBps: 460, lockDays: 21, decimals: 8 },
];

// Reward reserve seeded per vault, limited by what the deployer actually
// holds on testnet. cirBTC vault gets created but starts unfunded (0
// reserve) until topped up with real cirBTC — withdrawals needing interest
// beyond the reserve will simply fail honestly rather than mint fake yield.
const REWARD_SEED = { USDC: process.env.SEED_USDC_REWARDS || "0.5", EURC: process.env.SEED_EURC_REWARDS || "0.5", cirBTC: "0" };

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) throw new Error("No signer configured — set DEPLOYER_PRIVATE_KEY in contracts/.env");
  console.log("Deployer:", deployer.address);

  const Vault = await hre.ethers.getContractFactory("RailFlowYieldVault");
  const vault = await Vault.deploy(deployer.address);
  await vault.waitForDeployment();
  const address = await vault.getAddress();
  const deployReceipt = await vault.deploymentTransaction().wait();
  console.log("RailFlowYieldVault deployed to:", address, "at block", deployReceipt.blockNumber);

  const created = [];
  for (const v of VAULTS) {
    const lockSeconds = v.lockDays * 24 * 60 * 60;
    console.log(`Creating vault "${v.name}" (${v.symbol}) — APY ${v.apyBps / 100}%, lock ${v.lockDays}d...`);
    const tx = await vault.createVault(v.address, v.apyBps, lockSeconds);
    const receipt = await tx.wait();
    const vaultId = created.length; // vaults are created in order, 0-indexed
    created.push({ vaultId, ...v, lockSeconds });

    const seedAmount = REWARD_SEED[v.symbol];
    if (seedAmount && Number(seedAmount) > 0) {
      const amt = hre.ethers.parseUnits(seedAmount, v.decimals);
      const token = await hre.ethers.getContractAt("IERC20", v.address);
      console.log(`  Funding ${seedAmount} ${v.symbol} reward reserve...`);
      await (await token.approve(address, amt)).wait();
      await (await vault.fundRewards(vaultId, amt)).wait();
    } else {
      console.log(`  No reward reserve seeded yet for ${v.symbol} (none available) — fundRewards can top it up later.`);
    }
  }

  const outPath = path.join(__dirname, "..", "deployed-yield-vault.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        network: "arcTestnet",
        railFlowYieldVault: address,
        deployedAtBlock: deployReceipt.blockNumber,
        vaults: created,
        deployedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
  console.log("Wrote", outPath);
  console.log("\nNext: copy this into frontend/.env.local ->");
  console.log(`NEXT_PUBLIC_YIELD_VAULT_ADDRESS=${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
