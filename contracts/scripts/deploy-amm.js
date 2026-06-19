// Deploy RailFlowAMM (fallback swap pool) to Arc Testnet and seed USDC/EURC
// liquidity. Writes the pool address to config/deployed.json (key: swapPool).
//
//   npx hardhat run scripts/deploy-amm.js --network arcTestnet
//
// Prereq: DEPLOYER_PRIVATE_KEY wallet funded with the seed amounts of testnet
// USDC + EURC (config/arc.json swap.ownPool) plus a little USDC for gas.
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

const ARC_CONFIG_PATH = path.resolve(__dirname, "../../config/arc.json");
const DEPLOYED_PATH = path.resolve(__dirname, "../../config/deployed.json");

const ERC20_ABI = [
  "function approve(address,uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

async function main() {
  const arc = JSON.parse(fs.readFileSync(ARC_CONFIG_PATH, "utf8"));
  const { tokens, swap, network: net } = arc;
  const usdcAddr = tokens.USDC.address;
  const eurcAddr = tokens.EURC.address;
  const seedUSDC = ethers.parseUnits(swap.ownPool.seedUSDC, tokens.USDC.decimals);
  const seedEURC = ethers.parseUnits(swap.ownPool.seedEURC, tokens.EURC.decimals);

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Network: ", network.name);

  // Balance check before doing anything.
  const usdc = new ethers.Contract(usdcAddr, ERC20_ABI, deployer);
  const eurc = new ethers.Contract(eurcAddr, ERC20_ABI, deployer);
  const usdcBal = await usdc.balanceOf(deployer.address);
  const eurcBal = await eurc.balanceOf(deployer.address);
  console.log(`USDC balance: ${ethers.formatUnits(usdcBal, 6)}  (need ${swap.ownPool.seedUSDC} + gas)`);
  console.log(`EURC balance: ${ethers.formatUnits(eurcBal, 6)}  (need ${swap.ownPool.seedEURC})`);
  if (usdcBal < seedUSDC) throw new Error("Insufficient USDC to seed pool. Fund deployer at faucet.circle.com");
  if (eurcBal < seedEURC) throw new Error("Insufficient EURC to seed pool. Fund deployer at faucet.circle.com");

  // 1) Deploy the AMM.
  const AMM = await ethers.getContractFactory("RailFlowAMM");
  const amm = await AMM.deploy();
  await amm.waitForDeployment();
  const ammAddress = await amm.getAddress();
  console.log("RailFlowAMM deployed at:", ammAddress);

  // 2) Approve + seed USDC/EURC liquidity.
  await (await usdc.approve(ammAddress, seedUSDC)).wait();
  await (await eurc.approve(ammAddress, seedEURC)).wait();
  console.log("Approved USDC + EURC to the pool");
  await (await amm.addLiquidity(usdcAddr, eurcAddr, seedUSDC, seedEURC)).wait();
  console.log(`Seeded liquidity: ${swap.ownPool.seedUSDC} USDC + ${swap.ownPool.seedEURC} EURC`);

  // 3) Sanity quote: 1 USDC -> EURC.
  const oneUsdc = ethers.parseUnits("1", 6);
  const out = await amm.getAmountOut(usdcAddr, eurcAddr, oneUsdc);
  console.log(`Quote 1 USDC -> ${ethers.formatUnits(out, 6)} EURC`);

  // 4) Merge address into config/deployed.json.
  let deployed = {};
  if (fs.existsSync(DEPLOYED_PATH)) {
    try {
      deployed = JSON.parse(fs.readFileSync(DEPLOYED_PATH, "utf8"));
    } catch (_) {
      deployed = {};
    }
  }
  deployed.swapPool = ammAddress;
  fs.writeFileSync(DEPLOYED_PATH, JSON.stringify(deployed, null, 2) + "\n");
  console.log("Wrote swapPool address to", DEPLOYED_PATH);

  const explorer = (net && net.explorerUrl) || "https://testnet.arcscan.app";
  console.log(`Explorer: ${explorer}/address/${ammAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
