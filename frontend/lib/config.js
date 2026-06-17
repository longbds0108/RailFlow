// Static chain/config constants for RailFlow frontend.
// Live config (packages, staking params, disclaimer, stakingAddress) is fetched
// from the backend GET /api/config. These constants mirror config/arc.json for
// the values we need before/without a backend round-trip (chain definition, env).

export const ENV = {
  chainId: Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID || 5042002),
  rpcUrl: process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://rpc.testnet.arc.network",
  explorerUrl: process.env.NEXT_PUBLIC_ARC_EXPLORER_URL || "https://testnet.arcscan.app",
  appName: process.env.NEXT_PUBLIC_APP_NAME || "RailFlow",
  kitKey: process.env.NEXT_PUBLIC_KIT_KEY || "",
  apiBase: process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000",
  paymentReceiver: process.env.NEXT_PUBLIC_PAYMENT_RECEIVER || "",
};

// Arc Testnet chain definition for wagmi/viem (from config/arc.json).
export const ARC_TESTNET = {
  id: ENV.chainId,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: [ENV.rpcUrl] },
    public: { http: [ENV.rpcUrl] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: ENV.explorerUrl },
  },
  testnet: true,
};

// Hex chainId for wallet_addEthereumChain / wallet_switchEthereumChain.
export const ARC_CHAIN_ID_HEX = "0x" + ENV.chainId.toString(16);

// Params for wallet_addEthereumChain (EIP-3085).
export const ARC_ADD_CHAIN_PARAMS = {
  chainId: ARC_CHAIN_ID_HEX,
  chainName: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: [ENV.rpcUrl],
  blockExplorerUrls: [ENV.explorerUrl],
};

// Token registry (mirrors config/arc.json). cirBTC has no address → balance hidden.
export const TOKENS = {
  USDC: {
    address: "0x3600000000000000000000000000000000000000",
    decimals: 6,
    symbol: "USDC",
    appKitSymbol: "USDC",
    displayBalance: true,
  },
  EURC: {
    address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
    decimals: 6,
    symbol: "EURC",
    appKitSymbol: "EURC",
    displayBalance: true,
  },
  cirBTC: {
    address: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF",
    decimals: 8,
    symbol: "cirBTC",
    appKitSymbol: "cirBTC",
    displayBalance: true,
  },
};

// App Kit chain names (keep exactly as the SPEC requires).
export const APPKIT_CHAIN = {
  Arc_Testnet: "Arc_Testnet",
  Ethereum_Sepolia: "Ethereum_Sepolia",
  Base_Sepolia: "Base_Sepolia",
};

export function explorerTxUrl(hash) {
  if (!hash) return null;
  return `${ENV.explorerUrl}/tx/${hash}`;
}

export function explorerAddressUrl(addr) {
  if (!addr) return null;
  return `${ENV.explorerUrl}/address/${addr}`;
}
