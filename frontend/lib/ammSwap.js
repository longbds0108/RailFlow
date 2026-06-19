// Fallback swap via the self-deployed RailFlowAMM pool on Arc Testnet.
//
// Used when Circle App Kit's swap reverts (documented "unstable testnet
// liquidity"). This is a REAL on-chain swap: the user signs an ERC-20 approve
// then a swap() on our constant-product pool, in their own MetaMask. Same
// wallet-client pattern as the staking module.
import { parseUnits, formatUnits } from "viem";
import { getPublicClient, getWalletClient } from "wagmi/actions";
import { wagmiConfig as wagmiCfg } from "./wagmi";
import { ENV } from "./config";
import { erc20ApproveAbi } from "./erc20";

export const railflowAmmAbi = [
  {
    type: "function",
    name: "getAmountOut",
    stateMutability: "view",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "swap",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "minAmountOut", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
];

/** True when the RailFlow pool can serve this pair (seeded USDC/EURC only). */
export function ammSupportsPair(poolAddress, tokenIn, tokenOut) {
  const pair = new Set([tokenIn, tokenOut]);
  return Boolean(poolAddress) && pair.has("USDC") && pair.has("EURC") && tokenIn !== tokenOut;
}

/**
 * Execute a swap through RailFlowAMM. Returns { txHash, amountOut }.
 * @param tokens  config.tokens map (symbol -> { address, decimals })
 */
export async function ammSwap({ address, tokenIn, tokenOut, amountIn, slippageBps, poolAddress, tokens }) {
  if (!poolAddress) throw new Error("RailFlow pool not deployed");
  const inMeta = tokens[tokenIn];
  const outMeta = tokens[tokenOut];
  if (!inMeta || !outMeta) throw new Error("Unsupported token for RailFlow pool");

  const walletClient = await getWalletClient(wagmiCfg, { chainId: ENV.chainId });
  const publicClient = getPublicClient(wagmiCfg, { chainId: ENV.chainId });
  const amt = parseUnits(String(amountIn), inMeta.decimals);

  // Quote + slippage-protected minimum output.
  const expectedOut = await publicClient.readContract({
    address: poolAddress,
    abi: railflowAmmAbi,
    functionName: "getAmountOut",
    args: [inMeta.address, outMeta.address, amt],
  });
  if (expectedOut === 0n) throw new Error("RailFlow pool has no liquidity for this pair");
  const minOut = (expectedOut * BigInt(10_000 - slippageBps)) / 10_000n;

  // Approve the pool to pull tokenIn if needed.
  const allowance = await publicClient.readContract({
    address: inMeta.address,
    abi: erc20ApproveAbi,
    functionName: "allowance",
    args: [address, poolAddress],
  });
  if (allowance < amt) {
    const approveHash = await walletClient.writeContract({
      address: inMeta.address,
      abi: erc20ApproveAbi,
      functionName: "approve",
      args: [poolAddress, amt],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
  }

  // Swap.
  const txHash = await walletClient.writeContract({
    address: poolAddress,
    abi: railflowAmmAbi,
    functionName: "swap",
    args: [inMeta.address, outMeta.address, amt, minOut, address],
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return { txHash, amountOut: formatUnits(expectedOut, outMeta.decimals) };
}
