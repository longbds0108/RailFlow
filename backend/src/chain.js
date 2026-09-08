// Read-only viem public client on Arc Testnet + on-chain verification helpers.
import { createPublicClient, http, defineChain, parseUnits, getAddress } from "viem";
import { chain as chainCfg } from "./config.js";

const arcTestnet = defineChain({
  id: chainCfg.id,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [chainCfg.rpcUrl] } },
});

export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(chainCfg.rpcUrl),
});

// keccak256("Transfer(address,address,uint256)")
export const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/** Pad a 20-byte address to a 32-byte topic (lowercase). */
function addressTopic(address) {
  return ("0x" + address.toLowerCase().replace(/^0x/, "").padStart(64, "0"));
}

/** Fetch a receipt; returns null if not found / not yet mined. */
export async function getReceipt(txHash) {
  try {
    return await publicClient.getTransactionReceipt({ hash: txHash });
  } catch {
    return null;
  }
}

/** True if the tx is mined and succeeded. */
export async function txSucceeded(txHash) {
  const receipt = await getReceipt(txHash);
  return !!receipt && receipt.status === "success";
}

/**
 * Verify an ERC-20 Transfer of `tokenAddress` to `receiver` for >= `amountHuman`.
 * Works for any token (USDC/EURC/cirBTC). Returns { ok, reason }.
 */
export async function verifyTokenTransfer({ txHash, receiver, amountHuman, tokenAddress, decimals }) {
  const receipt = await getReceipt(txHash);
  if (!receipt) return { ok: false, reason: "tx_not_found" };
  if (receipt.status !== "success") return { ok: false, reason: "tx_failed" };

  const minAmount = parseUnits(String(amountHuman), decimals);
  const receiverTopic = addressTopic(receiver);
  const tokenLc = tokenAddress.toLowerCase();

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== tokenLc) continue;
    if (!log.topics?.length || log.topics[0].toLowerCase() !== TRANSFER_TOPIC) continue;
    // topics: [sig, from, to]; value is in data
    const to = log.topics[2]?.toLowerCase();
    if (to !== receiverTopic) continue;
    let value;
    try {
      value = BigInt(log.data);
    } catch {
      continue;
    }
    if (value >= minAmount) return { ok: true };
  }
  return { ok: false, reason: "no_matching_transfer" };
}

// JobEscrowVault — read-only ABI subset (backend only ever reads job state;
// every write happens client-side in the user's own wallet). See
// contracts/contracts/JobEscrowVault.sol.
export const jobEscrowVaultAbi = [
  {
    type: "function",
    name: "getJob",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "client", type: "address" },
          { name: "provider", type: "address" },
          { name: "evaluator", type: "address" },
          { name: "budget", type: "uint256" },
          { name: "requiredStake", type: "uint256" },
          { name: "expiredAt", type: "uint256" },
          { name: "activatedAt", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "description", type: "string" },
        ],
      },
    ],
  },
];

/** Read a job's current on-chain state. Throws if the call reverts (job doesn't exist). */
export async function getJobOnChain(jobVaultAddress, jobId) {
  return publicClient.readContract({
    address: jobVaultAddress,
    abi: jobEscrowVaultAbi,
    functionName: "getJob",
    args: [BigInt(jobId)],
  });
}

export { getAddress };
