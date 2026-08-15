import { http } from "wagmi";
import { defineChain } from "viem";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { ARC_TESTNET, ENV } from "./config";

// Arc Testnet chain for viem/wagmi, built from config.
export const arcTestnet = defineChain(ARC_TESTNET);

// getDefaultConfig wires up RainbowKit's default wallet list (MetaMask,
// WalletConnect, Coinbase Wallet, etc.) over wagmi for our single custom chain.
export const wagmiConfig = getDefaultConfig({
  appName: ENV.appName,
  projectId: ENV.walletConnectProjectId,
  chains: [arcTestnet],
  transports: {
    [arcTestnet.id]: http(ENV.rpcUrl),
  },
  ssr: true,
});
