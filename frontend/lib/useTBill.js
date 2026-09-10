"use client";

import { useCallback, useEffect, useState } from "react";
import { useConfig as useWagmiConfig, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { getPublicClient } from "wagmi/actions";
import { ENV, TOKENS } from "./config";
import { erc20Abi, erc20ApproveAbi } from "./erc20";
import { TBILL_ADDRESS, tbillAbi } from "./tbillContract";

const readAbi = [...erc20Abi, ...erc20ApproveAbi];

export function useTBillPosition(address, refreshKey = 0) {
  const wagmiCfg = useWagmiConfig();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!TBILL_ADDRESS) {
      setData(null);
      return;
    }
    let active = true;
    setLoading(true);
    const client = getPublicClient(wagmiCfg, { chainId: ENV.chainId });
    const tbill = { address: TBILL_ADDRESS, abi: tbillAbi };
    const usdc = TOKENS.USDC;

    Promise.all([
      client.readContract({ ...tbill, functionName: "currentNav" }),
      client.readContract({ ...tbill, functionName: "apyBps" }),
      client.readContract({ ...tbill, functionName: "totalUnits" }),
      client.readContract({ address: usdc.address, abi: readAbi, functionName: "balanceOf", args: [TBILL_ADDRESS] }),
      address ? client.readContract({ ...tbill, functionName: "unitsOf", args: [address] }) : Promise.resolve(0n),
      address ? client.readContract({ address: usdc.address, abi: readAbi, functionName: "balanceOf", args: [address] }) : Promise.resolve(0n),
      address ? client.readContract({ address: usdc.address, abi: readAbi, functionName: "allowance", args: [address, TBILL_ADDRESS] }) : Promise.resolve(0n),
    ]).then(([nav, apyBps, totalUnits, reserve, units, balance, allowance]) => {
      if (!active) return;
      setData({ nav, apyBps, totalUnits, reserve, units, balance, allowance });
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [address, wagmiCfg, refreshKey]);

  return { data, loading };
}

function useTBillAction(functionName) {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash, chainId: ENV.chainId });

  const write = useCallback(
    (args) => writeContract({ address: TBILL_ADDRESS, abi: tbillAbi, functionName, args, chainId: ENV.chainId }),
    [writeContract, functionName]
  );

  return { write, hash, isPending, isConfirming, isConfirmed, error, reset };
}

export function useSubscribeTBill() {
  return useTBillAction("subscribe");
}
export function useRedeemTBill() {
  return useTBillAction("redeem");
}
