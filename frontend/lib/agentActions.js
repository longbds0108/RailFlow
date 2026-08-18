// Executes an agent-proposed action using the exact same primitives as the
// manual Send/Swap/Stake/Bridge pages. The agent only ever proposes — this is
// the one place a proposal becomes a signed transaction, and it only runs
// after the user reviews the preview card and confirms.
import { parseUnits, decodeEventLog, keccak256, toHex } from "viem";
import { getPublicClient, getWalletClient } from "wagmi/actions";
import { wagmiConfig as wagmiCfg } from "./wagmi";
import { ENV } from "./config";
import { erc20TransferAbi, erc20ApproveAbi, arcStakingAbi } from "./erc20";
import { agenticCommerceAbi, ZERO_ADDRESS } from "./jobsAbi";
import { appkitSwap, appkitBridge, AppKitUnavailableError } from "./appkit";
import { ammSwap, ammSupportsPair } from "./ammSwap";
import { api } from "./api";

const CIRBTC_SLIPPAGE_BPS = 5000; // 50% — thin testnet pool, same as the Swap page.

async function execSend({ address, tokens }, input) {
  const { to, token, amount } = input;
  const tokenMeta = tokens[token];
  if (!tokenMeta?.address) throw new Error(`Unsupported token: ${token}`);

  const walletClient = await getWalletClient(wagmiCfg, { chainId: ENV.chainId });
  const publicClient = getPublicClient(wagmiCfg, { chainId: ENV.chainId });
  const units = parseUnits(String(amount), tokenMeta.decimals);

  const txHash = await walletClient.writeContract({
    address: tokenMeta.address,
    abi: erc20TransferAbi,
    functionName: "transfer",
    args: [to, units],
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });

  const record = await api
    .recordSend({ address, to, token, amount, txHash })
    .catch(() => ({ status: "success" }));
  return { txHash, status: record?.status || "success" };
}

async function execSwap({ address, tokens, swapPoolAddress, defaultSlippageBps }, input) {
  const { tokenIn, tokenOut, amountIn } = input;
  const slippageBps =
    tokenIn === "cirBTC" || tokenOut === "cirBTC" ? CIRBTC_SLIPPAGE_BPS : defaultSlippageBps ?? 500;

  let txHash, amountOut;
  let route = "circle";
  try {
    ({ txHash, amountOut } = await appkitSwap({ tokenIn, tokenOut, amountIn, slippageBps }));
  } catch (circleErr) {
    if (circleErr instanceof AppKitUnavailableError) throw circleErr;
    if (!ammSupportsPair(swapPoolAddress, tokenIn, tokenOut)) throw circleErr;
    route = "railflow";
    ({ txHash, amountOut } = await ammSwap({
      address,
      tokenIn,
      tokenOut,
      amountIn,
      slippageBps,
      poolAddress: swapPoolAddress,
      tokens,
    }));
  }

  const record = await api
    .recordSwap({ address, tokenIn, tokenOut, amountIn, amountOut: amountOut ?? null, txHash })
    .catch(() => ({ status: "success" }));
  return { txHash, amountOut, status: record?.status || "success", route };
}

async function execStake({ address, tokens, stakingAddress }, input) {
  const { action, token, amount } = input;
  const tokenMeta = tokens[token];
  if (!tokenMeta?.address) throw new Error(`Unsupported token: ${token}`);
  if (!stakingAddress) throw new Error("Staking contract is not deployed yet");

  const walletClient = await getWalletClient(wagmiCfg, { chainId: ENV.chainId });
  const publicClient = getPublicClient(wagmiCfg, { chainId: ENV.chainId });
  const decimals = tokenMeta.decimals;
  const amt = action === "claim" ? 0n : parseUnits(String(amount || "0"), decimals);

  if (action === "stake") {
    const allowance = await publicClient.readContract({
      address: tokenMeta.address,
      abi: erc20ApproveAbi,
      functionName: "allowance",
      args: [address, stakingAddress],
    });
    if (allowance < amt) {
      const approveHash = await walletClient.writeContract({
        address: tokenMeta.address,
        abi: erc20ApproveAbi,
        functionName: "approve",
        args: [stakingAddress, amt],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
    }
  }

  const fnArgs = action === "claim" ? [tokenMeta.address] : [tokenMeta.address, amt];
  const txHash = await walletClient.writeContract({
    address: stakingAddress,
    abi: arcStakingAbi,
    functionName: action,
    args: fnArgs,
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });

  const record = await api
    .recordStake({ address, action, token, amount: action === "claim" ? "0" : amount, txHash })
    .catch(() => ({ status: "success" }));
  return { txHash, status: record?.status || "success" };
}

async function execBridge({ address }, input) {
  const { fromChain, toChain, token, amount } = input;
  const { srcTxHash, state } = await appkitBridge({ fromChain, toChain, amount, token });
  const record = await api
    .recordBridge({ address, fromChain, toChain, token, amount, srcTxHash })
    .catch(() => ({ status: state === "success" ? "completed" : "pending_source" }));
  return { txHash: srcTxHash, status: record?.status || state };
}

async function execJobCreate({ jobsContract, jobsDefaultExpirySeconds }, input) {
  const { description, provider, evaluator, listingId } = input;
  if (!jobsContract) throw new Error("Jobs contract is not configured");

  const walletClient = await getWalletClient(wagmiCfg, { chainId: ENV.chainId });
  const publicClient = getPublicClient(wagmiCfg, { chainId: ENV.chainId });
  const block = await publicClient.getBlock();
  const expiredAt = block.timestamp + BigInt(jobsDefaultExpirySeconds || 3600);

  const txHash = await walletClient.writeContract({
    address: jobsContract,
    abi: agenticCommerceAbi,
    functionName: "createJob",
    args: [provider, evaluator, expiredAt, description, ZERO_ADDRESS],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  let jobId = null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== jobsContract.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: agenticCommerceAbi,
        data: log.data,
        topics: log.topics,
        eventName: "JobCreated",
      });
      jobId = decoded.args.jobId.toString();
      break;
    } catch {
      /* not the JobCreated log — skip */
    }
  }
  if (!jobId) throw new Error("Could not read the new job id back from the transaction.");

  const synced = await api.syncJob(jobId).catch(() => null);
  if (listingId != null) {
    await api.linkJobListing(listingId, jobId).catch(() => null);
  }
  return { txHash, jobId, status: synced?.status || "open" };
}

async function execJobVerdict({ jobsContract }, input) {
  const { jobId, verdict, reason } = input;
  if (!jobsContract) throw new Error("Jobs contract is not configured");

  const walletClient = await getWalletClient(wagmiCfg, { chainId: ENV.chainId });
  const publicClient = getPublicClient(wagmiCfg, { chainId: ENV.chainId });

  const txHash = await walletClient.writeContract({
    address: jobsContract,
    abi: agenticCommerceAbi,
    functionName: "complete",
    args: [BigInt(jobId), keccak256(toHex(reason || (verdict === "approve" ? "approved" : "rejected"))), "0x"],
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });

  const synced = await api.syncJob(jobId).catch(() => null);
  return { txHash, jobId, verdict, status: synced?.status || "unknown" };
}

/**
 * Execute a propose_* tool's input for real, signing in the user's wallet.
 * `ctx` carries the pieces of app config the action needs: { address, tokens,
 * stakingAddress, swapPoolAddress, defaultSlippageBps }.
 */
export async function executeProposedAction(name, input, ctx) {
  switch (name) {
    case "propose_send":
      return execSend(ctx, input);
    case "propose_swap":
      return execSwap(ctx, input);
    case "propose_stake":
      return execStake(ctx, input);
    case "propose_bridge":
      return execBridge(ctx, input);
    case "propose_create_job":
      return execJobCreate(ctx, input);
    case "propose_job_verdict":
      return execJobVerdict(ctx, input);
    default:
      throw new Error(`Unknown action: ${name}`);
  }
}
