"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, useConfig as useWagmiConfig } from "wagmi";
import { getPublicClient } from "wagmi/actions";
import { ENV, TOKENS } from "./config";
import { erc20Abi } from "./erc20";

// Read-only wallet state. Connecting, disconnecting, and switching networks
// are handled by RainbowKit's <ConnectButton /> (see Header.jsx / WalletGate.jsx).
export function useWallet() {
  // IMPORTANT: useAccount().chainId is the wallet's ACTUAL connected chain.
  // useChainId() only reflects the wagmi config's chain (always Arc here), so it
  // can't detect a wrong network — using it left the gate blind to mismatches.
  const { address, isConnected, chainId: accountChainId } = useAccount();
  const configChainId = useChainId();
  const chainId = accountChainId ?? configChainId;

  const [hasProvider, setHasProvider] = useState(true);

  useEffect(() => {
    setHasProvider(typeof window !== "undefined" && !!window.ethereum);
  }, []);

  const correctNetwork = isConnected && chainId === ENV.chainId;

  const status = useMemo(() => {
    if (!hasProvider) return "no-wallet";
    if (!isConnected) return "disconnected";
    if (!correctNetwork) return "wrong-network";
    return "ready";
  }, [hasProvider, isConnected, correctNetwork]);

  return {
    address,
    isConnected,
    chainId,
    correctNetwork,
    hasProvider,
    status,
  };
}

// Read USDC & EURC balances via viem ERC-20 balanceOf. cirBTC has no address → skipped.
export function useBalances(address, refreshKey = 0) {
  const wagmiCfg = useWagmiConfig();
  const [balances, setBalances] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!address) {
      setBalances({});
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    const client = getPublicClient(wagmiCfg, { chainId: ENV.chainId });
    const entries = Object.values(TOKENS).filter((t) => t.address && t.displayBalance);

    Promise.all(
      entries.map(async (t) => {
        try {
          const raw = await client.readContract({
            address: t.address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address],
          });
          return [t.symbol, { raw: raw.toString(), decimals: t.decimals }];
        } catch (e) {
          return [t.symbol, { raw: "0", decimals: t.decimals, error: e.message }];
        }
      })
    )
      .then((results) => {
        if (!active) return;
        setBalances(Object.fromEntries(results));
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
  }, [address, wagmiCfg, refreshKey]);

  return { balances, loading, error };
}
