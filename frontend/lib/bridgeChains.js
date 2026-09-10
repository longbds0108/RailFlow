import { sepolia, baseSepolia, avalancheFuji } from "viem/chains";
import { arcTestnet } from "./wagmi";
import { CHAIN_LOGOS } from "./logos";
import { TOKENS } from "./config";

// Real Arc Testnet + CCTP-supported testnets, with each chain's CCTP domain
// ID and real USDC address (Circle's USDC is always 6 decimals). Verified
// against developers.circle.com/stablecoins/usdc-contract-addresses.
export const BRIDGE_CHAINS = {
  Arc: {
    key: "Arc",
    name: "Arc Testnet",
    chain: arcTestnet,
    domain: 26,
    usdc: TOKENS.USDC.address,
    logo: CHAIN_LOGOS.Arc_Testnet,
  },
  Base: {
    key: "Base",
    name: "Base Sepolia",
    chain: baseSepolia,
    domain: 6,
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    logo: CHAIN_LOGOS.Base_Sepolia,
  },
  ETH: {
    key: "ETH",
    name: "ETH Sepolia",
    chain: sepolia,
    domain: 0,
    usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    logo: CHAIN_LOGOS.Ethereum_Sepolia,
  },
  Avalanche: {
    key: "Avalanche",
    name: "Avalanche Fuji",
    chain: avalancheFuji,
    domain: 1,
    usdc: "0x5425890298aed601595a70AB815c96711a31Bc65",
    logo: CHAIN_LOGOS.Avalanche_Fuji,
  },
};

export const BRIDGE_CHAIN_KEYS = ["Arc", "Base", "ETH", "Avalanche"];
