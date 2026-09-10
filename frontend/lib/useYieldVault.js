"use client";

import { useCallback, useEffect, useState } from "react";
import { useConfig as useWagmiConfig, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { getPublicClient } from "wagmi/actions";
import { ENV, TOKENS } from "./config";
import { erc20Abi, erc20ApproveAbi } from "./erc20";
import { YIELD_VAULT_ADDRESS, YIELD_VAULTS, yieldVaultAbi } from "./yieldVaultContract";

const readAbi = [...erc20Abi, ...erc20ApproveAbi];

// Real status for all 3 vaults at once: config (APY/lock), this user's open
// position (if any) with live accrued interest, and their wallet
// balance/allowance for that vault's asset.
export function useYieldPositions(address, refreshKey = 0) {
  const wagmiCfg = useWagmiConfig();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!YIELD_VAULT_ADDRESS) {
      setData(null);
      return;
    }
    let active = true;
    setLoading(true);
    const client = getPublicClient(wagmiCfg, { chainId: ENV.chainId });
    const vault = { address: YIELD_VAULT_ADDRESS, abi: yieldVaultAbi };

    Promise.all(
      YIELD_VAULTS.map(async ({ vaultId, name, symbol }) => {
        const token = TOKENS[symbol];
        const [cfg, reserve, position, pendingInterest, balance, allowance] = await Promise.all([
          client.readContract({ ...vault, functionName: "vaults", args: [BigInt(vaultId)] }),
          client.readContract({ address: token.address, abi: readAbi, functionName: "balanceOf", args: [YIELD_VAULT_ADDRESS] }),
          address
            ? client.readContract({ ...vault, functionName: "positions", args: [BigInt(vaultId), address] })
            : Promise.resolve([0n, 0n, 0n]),
          address
            ? client.readContract({ ...vault, functionName: "pendingInterest", args: [BigInt(vaultId), address] })
            : Promise.resolve(0n),
          address ? client.readContract({ address: token.address, abi: readAbi, functionName: "balanceOf", args: [address] }) : Promise.resolve(0n),
          address
            ? client.readContract({ address: token.address, abi: readAbi, functionName: "allowance", args: [address, YIELD_VAULT_ADDRESS] })
            : Promise.resolve(0n),
        ]);
        return [
          vaultId,
          {
            vaultId,
            name,
            symbol,
            asset: cfg[0],
            apyBps: cfg[1],
            lockSeconds: cfg[2],
            active: cfg[3],
            rewardReserve: reserve,
            principal: position[0],
            depositedAt: position[1],
            unlocksAt: position[2],
            pendingInterest,
            balance,
            allowance,
          },
        ];
      })
    ).then((entries) => {
      if (!active) return;
      setData(Object.fromEntries(entries));
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [address, wagmiCfg, refreshKey]);

  return { data, loading };
}

function useYieldVaultAction(functionName) {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash, chainId: ENV.chainId });

  const write = useCallback(
    (args) => writeContract({ address: YIELD_VAULT_ADDRESS, abi: yieldVaultAbi, functionName, args, chainId: ENV.chainId }),
    [writeContract, functionName]
  );

  return { write, hash, isPending, isConfirming, isConfirmed, error, reset };
}

export function useVaultDeposit() {
  return useYieldVaultAction("deposit");
}
export function useVaultWithdraw() {
  return useYieldVaultAction("withdraw");
}
