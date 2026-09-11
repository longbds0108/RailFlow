"use client";

import { useCallback, useEffect, useState } from "react";
import { useConfig as useWagmiConfig, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { getPublicClient } from "wagmi/actions";
import { ENV, TOKENS } from "./config";
import { erc20Abi, erc20ApproveAbi } from "./erc20";
import { LENDING_POOL_ADDRESS, LENDING_POOL_DEPLOYED_BLOCK, lendingPoolAbi } from "./lendingPoolContract";

const readAbi = [...erc20Abi, ...erc20ApproveAbi];
const SYMBOLS = ["USDC", "EURC", "cirBTC"];

// Full cross-asset Lend position: for each of USDC/EURC/cirBTC, how much the
// user has supplied/borrowed on RailFlowLendingPool, plus their wallet
// balance and allowance for that token, and the pool's own liquidity.
// `deployed` is false whenever NEXT_PUBLIC_LENDING_POOL_ADDRESS isn't set,
// so the Lend page can fall back to its illustrative preview.
export function useLendingPoolPosition(address, refreshKey = 0) {
  const wagmiCfg = useWagmiConfig();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const deployed = Boolean(LENDING_POOL_ADDRESS);

  useEffect(() => {
    if (!deployed || !address) {
      setData(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    const client = getPublicClient(wagmiCfg, { chainId: ENV.chainId });
    const pool = { address: LENDING_POOL_ADDRESS, abi: lendingPoolAbi };

    const perAsset = SYMBOLS.map(async (symbol) => {
      const token = TOKENS[symbol];
      // supplyBalanceOf/borrowBalanceOf return the real, currently-accrued
      // amount (principal + interest so far) — userAssets() alone only
      // holds the raw scaled-by-index storage value now that both sides
      // compound via a per-asset index.
      const [supplied, borrowed, config, balance, allowance, liquidity, supplyRateBps, borrowRateBps, utilizationBps] = await Promise.all([
        client.readContract({ ...pool, functionName: "supplyBalanceOf", args: [address, token.address] }),
        client.readContract({ ...pool, functionName: "borrowBalanceOf", args: [address, token.address] }),
        client.readContract({ ...pool, functionName: "assets", args: [token.address] }),
        client.readContract({ address: token.address, abi: readAbi, functionName: "balanceOf", args: [address] }),
        client.readContract({ address: token.address, abi: readAbi, functionName: "allowance", args: [address, LENDING_POOL_ADDRESS] }),
        client.readContract({ address: token.address, abi: readAbi, functionName: "balanceOf", args: [LENDING_POOL_ADDRESS] }),
        client.readContract({ ...pool, functionName: "supplyRateBps", args: [token.address] }),
        client.readContract({ ...pool, functionName: "borrowRateBps", args: [token.address] }),
        client.readContract({ ...pool, functionName: "utilizationBps", args: [token.address] }),
      ]);
      return [
        symbol,
        {
          supplied,
          borrowed,
          decimals: config[0],
          priceInUsdc: config[1],
          collateralFactorBps: config[2],
          liquidationThresholdBps: config[3],
          liquidationBonusBps: config[4],
          borrowable: config[5],
          listed: config[6],
          balance,
          allowance,
          liquidity,
          supplyRateBps,
          borrowRateBps,
          utilizationBps,
        },
      ];
    });

    Promise.all([
      ...perAsset,
      client.readContract({ ...pool, functionName: "accountData", args: [address] }),
      client.readContract({ ...pool, functionName: "isLiquidatable", args: [address] }),
    ])
      .then((results) => {
        if (!active) return;
        const isLiquidatable = results.pop();
        const accountData = results.pop();
        setData({
          assets: Object.fromEntries(results),
          collateralValue: accountData[0],
          borrowValue: accountData[1],
          isLiquidatable,
        });
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        setError(e.message);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [address, wagmiCfg, refreshKey, deployed]);

  return { data, loading, error, deployed };
}

// One write action (approve, or supply/withdraw/borrow/repay). Returns its
// own pending/confirming/confirmed state so the Lend page can show
// per-button loading. `write(argsArray)` — e.g. write([token, amount]) for a
// pool call, or write([spender, amount]) for an ERC-20 approve.
function useLendingPoolAction({ address, abi, functionName }) {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash, chainId: ENV.chainId });

  // Pinning chainId means clicking Supply/Borrow/etc. while the wallet is on
  // a different network (e.g. switched via the header's Bridge-oriented
  // network picker) prompts a switch back to Arc first, instead of silently
  // trying to call this Arc-only contract on whatever chain is active.
  const write = useCallback(
    (args) => writeContract({ address, abi, functionName, args, chainId: ENV.chainId }),
    [writeContract, address, abi, functionName]
  );

  return { write, hash, isPending, isConfirming, isConfirmed, error, reset };
}

export function useApproveToken(tokenAddress) {
  return useLendingPoolAction({ address: tokenAddress, abi: erc20ApproveAbi, functionName: "approve" });
}
export function useSupply() {
  return useLendingPoolAction({ address: LENDING_POOL_ADDRESS, abi: lendingPoolAbi, functionName: "supply" });
}
export function useWithdraw() {
  return useLendingPoolAction({ address: LENDING_POOL_ADDRESS, abi: lendingPoolAbi, functionName: "withdraw" });
}
export function useBorrow() {
  return useLendingPoolAction({ address: LENDING_POOL_ADDRESS, abi: lendingPoolAbi, functionName: "borrow" });
}
export function useRepay() {
  return useLendingPoolAction({ address: LENDING_POOL_ADDRESS, abi: lendingPoolAbi, functionName: "repay" });
}

// ---------- Debt-guardrail agent mandate ----------

export function useSetMandate() {
  return useLendingPoolAction({ address: LENDING_POOL_ADDRESS, abi: lendingPoolAbi, functionName: "setRepayMandate" });
}
export function useRevokeMandate() {
  return useLendingPoolAction({ address: LENDING_POOL_ADDRESS, abi: lendingPoolAbi, functionName: "revokeMandate" });
}

// A user's current mandate plus their live utilization, wallet balance and
// pool allowance for the mandate's repay token — everything the Agent page
// needs to show status and explain why the agent can or can't act right now.
export function useMandateStatus(address, refreshKey = 0) {
  const wagmiCfg = useWagmiConfig();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const deployed = Boolean(LENDING_POOL_ADDRESS);

  useEffect(() => {
    if (!deployed || !address) {
      setData(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    const client = getPublicClient(wagmiCfg, { chainId: ENV.chainId });
    const pool = { address: LENDING_POOL_ADDRESS, abi: lendingPoolAbi };

    client
      .readContract({ ...pool, functionName: "mandateStatus", args: [address] })
      .then(async (status) => {
        const [agent, repayToken, thresholdBps, dailyLimit, spentToday, reserveAmount, expiresAt, active_, currentUtilizationBps] = status;
        if (!active_) {
          if (active) {
            setData({ active: false, agent, repayToken, thresholdBps, dailyLimit, spentToday, reserveAmount, expiresAt, currentUtilizationBps });
            setLoading(false);
          }
          return;
        }
        const [borrowed, walletBalance, allowance] = await Promise.all([
          client.readContract({ ...pool, functionName: "borrowBalanceOf", args: [address, repayToken] }),
          client.readContract({ address: repayToken, abi: readAbi, functionName: "balanceOf", args: [address] }),
          client.readContract({ address: repayToken, abi: readAbi, functionName: "allowance", args: [address, LENDING_POOL_ADDRESS] }),
        ]);
        if (!active) return;
        setData({
          active: active_,
          agent,
          repayToken,
          thresholdBps,
          dailyLimit,
          spentToday,
          reserveAmount,
          expiresAt,
          currentUtilizationBps,
          borrowed,
          walletBalance,
          allowance,
        });
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        setError(e.message);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [address, wagmiCfg, refreshKey, deployed]);

  return { data, loading, error };
}

// Real decision history: every AgentRepaid event for this user, read
// straight from the chain (the contract's own event log *is* the record —
// no separate database). Answers exactly what each decision needs to: why
// (utilization was above threshold), how much, and how the position changed.
export function useAgentDecisionLog(address, refreshKey = 0) {
  const wagmiCfg = useWagmiConfig();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!LENDING_POOL_ADDRESS || !address) {
      setEntries([]);
      return;
    }
    let active = true;
    setLoading(true);
    const client = getPublicClient(wagmiCfg, { chainId: ENV.chainId });

    client
      .getContractEvents({
        address: LENDING_POOL_ADDRESS,
        abi: lendingPoolAbi,
        eventName: "AgentRepaid",
        args: { user: address },
        fromBlock: LENDING_POOL_DEPLOYED_BLOCK,
        toBlock: "latest",
      })
      .then(async (logs) => {
        const withTimestamps = await Promise.all(
          logs.map(async (log) => {
            const block = await client.getBlock({ blockNumber: log.blockNumber });
            return {
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
              timestamp: Number(block.timestamp) * 1000,
              token: log.args.token,
              amount: log.args.amount,
              utilizationBpsBefore: log.args.utilizationBpsBefore,
              utilizationBpsAfter: log.args.utilizationBpsAfter,
              remainingBorrowed: log.args.remainingBorrowed,
            };
          })
        );
        if (!active) return;
        withTimestamps.sort((a, b) => b.blockNumber - a.blockNumber);
        setEntries(withTimestamps);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [address, wagmiCfg, refreshKey]);

  return { entries, loading };
}
