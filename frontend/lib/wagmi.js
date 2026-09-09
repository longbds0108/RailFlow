import { http } from "wagmi";
import { defineChain } from "viem";
import { sepolia, baseSepolia } from "viem/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { ARC_TESTNET, ENV } from "./config";

// Arc Testnet chain for viem/wagmi, built from config.
export const arcTestnet = defineChain(ARC_TESTNET);

// getDefaultConfig wires up RainbowKit's default wallet list (MetaMask,
// WalletConnect, Coinbase Wallet, etc.). Arc Testnet is home (first = default
// chain on connect); Sepolia and Base Sepolia are also registered — not for
// any RailFlow feature to run on, but so the header's network switcher can
// list them directly, since Bridge's CCTP mint step already requires signing
// on whichever of these is the destination chain anyway.
export const wagmiConfig = getDefaultConfig({
  appName: ENV.appName,
  projectId: ENV.walletConnectProjectId,
  chains: [arcTestnet, sepolia, baseSepolia],
  transports: {
    [arcTestnet.id]: http(ENV.rpcUrl),
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
  },
  ssr: true,
});
