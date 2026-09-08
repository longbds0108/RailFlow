// Deploy JobEscrowVault (self-contained OTC-style job escrow with a demo
// yield vault) to Arc Testnet, then seed its USDC reward pool. Writes the
// address to config/deployed.json (key: jobVault).
//
//   npx hardhat run scripts/deploy-jobvault.js --network arcTestnet
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

const ARC_CONFIG_PATH = path.resolve(__dirname, "../../config/arc.json");
const DEPLOYED_PATH = path.resolve(__dirname, "../../config/deployed.json");

async function main() {
  const arc = JSON.parse(fs.readFileSync(ARC_CONFIG_PATH, "utf8"));
  const { tokens, jobs, network: net } = arc;
  const usdcAddress = tokens.USDC.address;
  const apyBps = jobs.vault.apyBps;
  const rewardPoolFund = ethers.parseUnits(jobs.vault.rewardPoolFund, tokens.USDC.decimals);

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Network: ", network.name);

  const usdc = await ethers.getContractAt("IERC20", usdcAddress);
  const balance = await usdc.balanceOf(deployer.address);
  console.log(`Deployer USDC balance: ${ethers.formatUnits(balance, 6)} (need ${jobs.vault.rewardPoolFund} + gas)`);
  if (balance < rewardPoolFund) {
    throw new Error("Insufficient USDC to seed the reward pool. Fund deployer at faucet.circle.com");
  }

  const JobEscrowVault = await ethers.getContractFactory("JobEscrowVault");
  const vault = await JobEscrowVault.deploy(usdcAddress, apyBps);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("JobEscrowVault deployed at:", vaultAddress);

  await (await usdc.approve(vaultAddress, rewardPoolFund)).wait();
  await (await vault.fundRewardPool(rewardPoolFund)).wait();
  console.log(`Funded demo yield reward pool with ${jobs.vault.rewardPoolFund} USDC`);

  let deployed = {};
  if (fs.existsSync(DEPLOYED_PATH)) {
    try {
      deployed = JSON.parse(fs.readFileSync(DEPLOYED_PATH, "utf8"));
    } catch (_) {
      deployed = {};
    }
  }
  deployed.jobVault = vaultAddress;
  fs.writeFileSync(DEPLOYED_PATH, JSON.stringify(deployed, null, 2) + "\n");
  console.log("Wrote jobVault address to", DEPLOYED_PATH);

  const explorer = (net && net.explorerUrl) || "https://testnet.arcscan.app";
  console.log(`Explorer: ${explorer}/address/${vaultAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
