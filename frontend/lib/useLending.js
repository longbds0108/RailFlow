"use client";

import { useCallback, useEffect, useState } from "react";
import { useConfig as useWagmiConfig, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { getPublicClient } from "wagmi/actions";
import { ENV, TOKENS } from "./config";
import { erc20Abi, erc20ApproveAbi } from "./erc20";
import { LENDING_ADDRESS, lendingAbi } from "./lendingContract";

const readAbi = [...erc20Abi, ...erc20ApproveAbi];

// On-chain Lend position: cirBTC collateral deposited + USDC borrowed against
// it, read from the deployed LendingBorrowing contract. `deployed` is false
// whenever NEXT_PUBLIC_LENDING_ADDRESS isn't set, so the Lend page can fall
// back to its illustrative preview instead of showing broken reads.
export function useLendingPosition(address, refreshKey = 0) {
  const wagmiCfg = useWagmiConfig();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const deployed = Boolean(LENDING_ADDRESS);

  useEffect(() => {
    if (!deployed || !address) {
      setData(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    const client = getPublicClient(wagmiCfg, { chainId: ENV.chainId });

    Promise.all([
      client.readContract({ address: LENDING_ADDRESS, abi: lendingAbi, functionName: "positions", args: [address] }),
      client.readContract({ address: LENDING_ADDRESS, abi: lendingAbi, functionName: "maxBorrow", args: [address] }),
      client.readContract({ address: LENDING_ADDRESS, abi: lendingAbi, functionName: "availableToBorrow", args: [address] }),
      client.readContract({ address: LENDING_ADDRESS, abi: lendingAbi, functionName: "collateralFactorBps" }),
      client.readContract({ address: LENDING_ADDRESS, abi: lendingAbi, functionName: "collateralPrice" }),
      client.readContract({ address: TOKENS.cirBTC.address, abi: readAbi, functionName: "balanceOf", args: [address] }),
      client.readContract({ address: TOKENS.cirBTC.address, abi: readAbi, functionName: "allowance", args: [address, LENDING_ADDRESS] }),
      client.readContract({ address: TOKENS.USDC.address, abi: readAbi, functionName: "balanceOf", args: [address] }),
      client.readContract({ address: TOKENS.USDC.address, abi: readAbi, functionName: "allowance", args: [address, LENDING_ADDRESS] }),
      client.readContract({ address: TOKENS.USDC.address, abi: readAbi, functionName: "balanceOf", args: [LENDING_ADDRESS] }),
    ])
      .then(
        ([
          position,
          maxBorrow,
          availableToBorrow,
          collateralFactorBps,
          collateralPrice,
          cirBtcBalance,
          cirBtcAllowance,
          usdcBalance,
          usdcAllowance,
          poolLiquidity,
        ]) => {
          if (!active) return;
          setData({
            collateral: position[0],
            borrowed: position[1],
            maxBorrow,
            availableToBorrow,
            collateralFactorBps,
            collateralPrice,
            cirBtcBalance,
            cirBtcAllowance,
            usdcBalance,
            usdcAllowance,
            poolLiquidity,
          });
          setLoading(false);
        }
      )
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

// One write action: approve, or one of the four contract calls. Returns its
// own pending/confirming/confirmed state so the Lend page can show per-button
// loading without a shared spinner. `write(argsArray)` — e.g. write([amount])
// for a contract call, or write([spender, amount]) for an ERC-20 approve.
function useLendingAction({ address, abi, functionName }) {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const write = useCallback(
    (args) => writeContract({ address, abi, functionName, args }),
    [writeContract, address, abi, functionName]
  );

  return { write, hash, isPending, isConfirming, isConfirmed, error, reset };
}

export function useApproveCirBtc() {
  return useLendingAction({ address: TOKENS.cirBTC.address, abi: erc20ApproveAbi, functionName: "approve" });
}
export function useApproveUsdc() {
  return useLendingAction({ address: TOKENS.USDC.address, abi: erc20ApproveAbi, functionName: "approve" });
}
export function useDepositCollateral() {
  return useLendingAction({ address: LENDING_ADDRESS, abi: lendingAbi, functionName: "depositCollateral" });
}
export function useWithdrawCollateral() {
  return useLendingAction({ address: LENDING_ADDRESS, abi: lendingAbi, functionName: "withdrawCollateral" });
}
export function useTakeLoan() {
  return useLendingAction({ address: LENDING_ADDRESS, abi: lendingAbi, functionName: "takeLoan" });
}
export function useRepayLoan() {
  return useLendingAction({ address: LENDING_ADDRESS, abi: lendingAbi, functionName: "repayLoan" });
}
