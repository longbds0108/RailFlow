import { http } from "wagmi";
import { defineChain } from "viem";
import { sepolia, baseSepolia, avalancheFuji } from "viem/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { ARC_TESTNET, ENV } from "./config";

// Arc Testnet chain for viem/wagmi, built from config. RainbowKit only has
// built-in icons for chains it recognizes by id, so a brand-new chain like
// Arc renders with no logo in its network modal unless we set iconUrl /
// iconBackground ourselves — viem's defineChain preserves these extra
// fields even though they aren't part of viem's own Chain type.
export const arcTestnet = defineChain({
  ...ARC_TESTNET,
  iconUrl: "/logos/arc-testnet.jpg",
  iconBackground: "#0b0e17",
});

// viem's own Sepolia chain is named "Sepolia" — renamed here so RainbowKit's
// network switcher and account modal match the "ETH Sepolia" label used
// everywhere else in the app (Bridge page, header network pill).
const ethSepolia = { ...sepolia, name: "ETH Sepolia" };

// getDefaultConfig wires up RainbowKit's default wallet list (MetaMask,
// WalletConnect, Coinbase Wallet, etc.). Order matches the header's network
// switcher: Arc Testnet (home/default chain on connect), Base Sepolia,
// Avalanche Fuji, ETH Sepolia — the four chains Bridge's real CCTP flow can
// switch the wallet to as the source (burn) or destination (mint) chain.
export const wagmiConfig = getDefaultConfig({
  appName: ENV.appName,
  projectId: ENV.walletConnectProjectId,
  chains: [arcTestnet, baseSepolia, avalancheFuji, ethSepolia],
  transports: {
    [arcTestnet.id]: http(ENV.rpcUrl),
    [baseSepolia.id]: http(),
    [avalancheFuji.id]: http(),
    [ethSepolia.id]: http(),
  },
  ssr: true,
});
