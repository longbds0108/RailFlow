"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";

// Fallback config mirrors config/arc.json so the UI is usable even if the
// backend GET /api/config is briefly unavailable. The backend remains the
// source of truth (esp. stakingAddress from deployed.json).
const FALLBACK_CONFIG = {
  network: {
    name: "Arc Testnet",
    chainId: 5042002,
    explorerUrl: "https://testnet.arcscan.app",
  },
  packages: [
    { id: "starter", name: "Starter Demo", priceUsdc: "1.00", description: "Entry demo package to test USDC checkout on Arc Testnet." },
    { id: "pro", name: "Pro Demo", priceUsdc: "5.00", description: "Mid-tier demo package with more sample items." },
    { id: "premium", name: "Premium Demo", priceUsdc: "10.00", description: "Top demo package showcasing a larger USDC payment." },
  ],
  payment: { receiver: "0x171A4217b86A807A64eB94757Db6849fb4bDbAA0", token: "USDC" },
  swap: { pairs: [["USDC", "EURC"], ["USDC", "cirBTC"], ["EURC", "cirBTC"]], defaultSlippageBps: 50 },
  bridge: {
    supportedChains: [
      { appKitName: "Arc_Testnet", label: "Arc Testnet" },
      { appKitName: "Ethereum_Sepolia", label: "Ethereum Sepolia" },
      { appKitName: "Base_Sepolia", label: "Base Sepolia" },
    ],
    tokens: ["USDC"],
  },
  staking: { rewardToken: "USDC", apyBps: 1000, lockSeconds: 0, minStake: "1.00", stakableTokens: ["USDC", "EURC"] },
  disclaimer: {
    en: "This is a testnet demo. All tokens used in this application, including testnet USDC, EURC, and cirBTC, have no real-world value. This application is not a payment service, exchange, investment product, or yield product, and does not provide any real financial return.",
  },
  stakingAddress: null,
};

const ConfigContext = createContext({
  config: FALLBACK_CONFIG,
  loading: true,
  error: null,
  usingFallback: true,
});

export function ConfigProvider({ children }) {
  const [state, setState] = useState({
    config: FALLBACK_CONFIG,
    loading: true,
    error: null,
    usingFallback: true,
  });

  useEffect(() => {
    let active = true;
    api
      .getConfig()
      .then((cfg) => {
        if (!active) return;
        setState({ config: { ...FALLBACK_CONFIG, ...cfg }, loading: false, error: null, usingFallback: false });
      })
      .catch((err) => {
        if (!active) return;
        setState({ config: FALLBACK_CONFIG, loading: false, error: err.message, usingFallback: true });
      });
    return () => {
      active = false;
    };
  }, []);

  return <ConfigContext.Provider value={state}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  return useContext(ConfigContext);
}
