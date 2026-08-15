// One-time script: register the RailFlow Assistant as an ERC-8004 agent
// identity on Arc Testnet, using Circle Developer-Controlled Wallets
// (custodial — managed by Circle, not the end user). This is a different
// Circle product from the App Kit used elsewhere in RailFlow: App Kit signs
// on behalf of the connected user's own wallet; this script creates and
// controls its own wallets solely to hold the agent's on-chain identity.
// Idempotent — safe to re-run; reuses wallets/skips registration if already
// present in config/deployed.json.
//
// Usage: cd backend && npm run register-identity
// Requires (root .env): CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET, METADATA_URI
// (upload config/agentMetadata.json to IPFS first — e.g. app.pinata.cloud —
// and paste the resulting ipfs://... URI as METADATA_URI).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { parseAbiItem } from "viem";
import { env } from "../src/config.js";
import { publicClient } from "../src/chain.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const DEPLOYED_PATH = resolve(repoRoot, "config", "deployed.json");

const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const BLOCKCHAIN = "ARC-TESTNET";

function readDeployed() {
  if (!existsSync(DEPLOYED_PATH)) return {};
  try {
    return JSON.parse(readFileSync(DEPLOYED_PATH, "utf8"));
  } catch {
    return {};
  }
}

function writeDeployed(deployed) {
  writeFileSync(DEPLOYED_PATH, JSON.stringify(deployed, null, 2) + "\n");
}

async function pollTransaction(circleClient, id) {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const { data } = await circleClient.getTransaction({ id });
    if (data?.transaction?.state === "COMPLETE") return data.transaction.txHash;
    if (data?.transaction?.state === "FAILED") {
      throw new Error(`Transaction ${id} failed: ${JSON.stringify(data?.transaction)}`);
    }
  }
  throw new Error(`Transaction ${id} did not complete after 60s`);
}

async function main() {
  if (!env.circleApiKey || !env.circleEntitySecret) {
    throw new Error(
      "Missing CIRCLE_API_KEY / CIRCLE_ENTITY_SECRET in .env. Create a Developer-Controlled " +
        "Wallets API key and register an Entity Secret in the Circle Developer Console first."
    );
  }
  if (!env.metadataUri) {
    throw new Error(
      "Missing METADATA_URI in .env. Upload config/agentMetadata.json to IPFS " +
        "(e.g. app.pinata.cloud) and paste the resulting ipfs://... URI."
    );
  }

  const deployed = readDeployed();
  const existing = deployed.agentIdentity;
  if (existing?.agentId) {
    console.log(`Already registered — Agent ID ${existing.agentId} (owner ${existing.ownerWalletAddress}).`);
    console.log(`Explorer: https://testnet.arcscan.app/tx/${existing.registerTxHash}`);
    return;
  }

  const circleClient = initiateDeveloperControlledWalletsClient({
    apiKey: env.circleApiKey,
    entitySecret: env.circleEntitySecret,
  });

  let ownerWallet, validatorWallet;
  if (existing?.ownerWalletId && existing?.validatorWalletId) {
    console.log("Reusing existing wallets from config/deployed.json");
    ownerWallet = { id: existing.ownerWalletId, address: existing.ownerWalletAddress };
    validatorWallet = { id: existing.validatorWalletId, address: existing.validatorWalletAddress };
  } else {
    console.log("Creating wallet set + 2 SCA wallets on Arc Testnet...");
    const walletSet = await circleClient.createWalletSet({ name: "RailFlow Agent Wallets" });
    const walletsResponse = await circleClient.createWallets({
      blockchains: [BLOCKCHAIN],
      count: 2,
      walletSetId: walletSet.data?.walletSet?.id ?? "",
      accountType: "SCA",
    });
    [ownerWallet, validatorWallet] = walletsResponse.data?.wallets ?? [];
    if (!ownerWallet || !validatorWallet) throw new Error("Circle did not return 2 wallets");
    console.log("Owner wallet:    ", ownerWallet.address);
    console.log("Validator wallet:", validatorWallet.address);
    // Persist wallet IDs immediately so a crash before registration doesn't
    // orphan them — re-running the script reuses these instead of creating new ones.
    writeDeployed({
      ...deployed,
      agentIdentity: {
        ownerWalletId: ownerWallet.id,
        ownerWalletAddress: ownerWallet.address,
        validatorWalletId: validatorWallet.id,
        validatorWalletAddress: validatorWallet.address,
      },
    });
  }

  console.log("Registering identity on IdentityRegistry...");
  const registerTx = await circleClient.createContractExecutionTransaction({
    walletAddress: ownerWallet.address,
    blockchain: BLOCKCHAIN,
    contractAddress: IDENTITY_REGISTRY,
    abiFunctionSignature: "register(string)",
    abiParameters: [env.metadataUri],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });
  const registerTxHash = await pollTransaction(circleClient, registerTx.data?.id);
  console.log(`Registered: https://testnet.arcscan.app/tx/${registerTxHash}`);

  console.log("Reading Agent ID from Transfer event...");
  const latestBlock = await publicClient.getBlockNumber();
  const blockRange = 10000n;
  const fromBlock = latestBlock > blockRange ? latestBlock - blockRange : 0n;
  const transferLogs = await publicClient.getLogs({
    address: IDENTITY_REGISTRY,
    event: parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"),
    args: { to: ownerWallet.address },
    fromBlock,
    toBlock: latestBlock,
  });
  if (transferLogs.length === 0) {
    throw new Error(
      "No Transfer events found for the owner wallet — registration may not have finished indexing yet. Re-run the script in a minute."
    );
  }
  const agentId = transferLogs[transferLogs.length - 1].args.tokenId.toString();
  console.log(`Agent ID: ${agentId}`);

  writeDeployed({
    ...readDeployed(),
    agentIdentity: {
      agentId,
      ownerWalletId: ownerWallet.id,
      ownerWalletAddress: ownerWallet.address,
      validatorWalletId: validatorWallet.id,
      validatorWalletAddress: validatorWallet.address,
      metadataURI: env.metadataUri,
      registerTxHash,
      registeredAt: new Date().toISOString(),
    },
  });
  console.log(`Wrote agent identity to ${DEPLOYED_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
