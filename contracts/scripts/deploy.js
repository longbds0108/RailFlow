const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

// Shared chain/token/module config (single source of truth).
const ARC_CONFIG_PATH = path.resolve(__dirname, "../../config/arc.json");
const DEPLOYED_PATH = path.resolve(__dirname, "../../config/deployed.json");

function parseUnits6(amountStr) {
  return ethers.parseUnits(amountStr, 6);
}

async function main() {
  const arc = JSON.parse(fs.readFileSync(ARC_CONFIG_PATH, "utf8"));
  const { tokens, staking, network: net } = arc;

  const usdcAddress = tokens.USDC.address;
  const eurcAddress = tokens.EURC.address;

  const apyBps = staking.apyBps; // 1000
  const lockSeconds = staking.lockSeconds; // 0
  const minStake = parseUnits6(staking.minStake); // "1.00" -> 1000000
  const rewardPoolFund = parseUnits6(staking.rewardPoolFund); // "10.00" -> 10000000

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Network: ", network.name);

  // 1) Deploy ArcStaking (reward token = USDC).
  const ArcStaking = await ethers.getContractFactory("ArcStaking");
  const stakingContract = await ArcStaking.deploy(
    usdcAddress,
    apyBps,
    lockSeconds,
    minStake
  );
  await stakingContract.waitForDeployment();
  const stakingAddress = await stakingContract.getAddress();
  console.log("ArcStaking deployed at:", stakingAddress);

  // 2) Allow USDC & EURC as stakable tokens.
  await (await stakingContract.setAllowedToken(usdcAddress, true)).wait();
  await (await stakingContract.setAllowedToken(eurcAddress, true)).wait();
  console.log("Allowed stakable tokens: USDC, EURC");

  // 3) Fund the USDC reward pool from the deployer.
  const usdc = await ethers.getContractAt("IERC20", usdcAddress);
  await (await usdc.approve(stakingAddress, rewardPoolFund)).wait();
  await (await stakingContract.fundRewardPool(rewardPoolFund)).wait();
  console.log(
    `Funded reward pool with ${staking.rewardPoolFund} USDC (${rewardPoolFund.toString()} units)`
  );

  // 4) Write/merge deployed address to config/deployed.json.
  let deployed = {};
  if (fs.existsSync(DEPLOYED_PATH)) {
    try {
      deployed = JSON.parse(fs.readFileSync(DEPLOYED_PATH, "utf8"));
    } catch (_) {
      deployed = {};
    }
  }
  deployed.staking = stakingAddress;
  fs.writeFileSync(DEPLOYED_PATH, JSON.stringify(deployed, null, 2) + "\n");
  console.log("Wrote staking address to", DEPLOYED_PATH);

  // 5) Log explorer link.
  const explorer = (net && net.explorerUrl) || "https://testnet.arcscan.app";
  console.log(`Explorer: ${explorer}/address/${stakingAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
