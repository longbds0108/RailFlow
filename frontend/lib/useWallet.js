"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useChainId,
  useConfig as useWagmiConfig,
} from "wagmi";
import { getPublicClient } from "wagmi/actions";
import { ENV, ARC_CHAIN_ID_HEX, ARC_ADD_CHAIN_PARAMS, TOKENS } from "./config";
import { erc20Abi } from "./erc20";

export function useWallet() {
  // IMPORTANT: useAccount().chainId is the wallet's ACTUAL connected chain.
  // useChainId() only reflects the wagmi config's chain (always Arc here), so it
  // can't detect a wrong network — using it left the gate blind to mismatches.
  const { address, isConnected, chainId: accountChainId } = useAccount();
  const configChainId = useChainId();
  const chainId = accountChainId ?? configChainId;
  const { connect, connectors, isPending: isConnecting, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();

  const [hasProvider, setHasProvider] = useState(true);

  useEffect(() => {
    setHasProvider(typeof window !== "undefined" && !!window.ethereum);
  }, []);

  const correctNetwork = isConnected && chainId === ENV.chainId;

  const connectMetaMask = useCallback(() => {
    const injectedConnector =
      connectors.find((c) => c.id === "metaMask" || c.id === "io.metamask") ||
      connectors.find((c) => c.type === "injected") ||
      connectors[0];
    if (injectedConnector) connect({ connector: injectedConnector });
  }, [connect, connectors]);

  // Switch / add Arc Testnet via wallet RPC (EIP-3085/3326).
  const switchToArc = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARC_CHAIN_ID_HEX }],
      });
    } catch (err) {
      // 4902 = chain not added → add it, then switch happens automatically.
      if (err && (err.code === 4902 || err.code === -32603)) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [ARC_ADD_CHAIN_PARAMS],
        });
      } else {
        throw err;
      }
    }
  }, []);

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
    isConnecting,
    connectError,
    connectMetaMask,
    disconnect,
    switchToArc,
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
