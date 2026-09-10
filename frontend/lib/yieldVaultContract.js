// RailFlowYieldVault: real fixed-term, fixed-rate vaults on Arc Testnet.
// Source: contracts/contracts/RailFlowYieldVault.sol. Vault ids are fixed at
// deploy time (see contracts/deployed-yield-vault.json): 0 = Stable Yield
// (USDC), 1 = Euro Yield (EURC), 2 = cirBTC staking. Address is only set
// once deployed — an empty address means no real vault exists yet.
export const YIELD_VAULT_ADDRESS = process.env.NEXT_PUBLIC_YIELD_VAULT_ADDRESS || "";
export const YIELD_VAULT_DEPLOYED_BLOCK = 61381554n;

export const YIELD_VAULTS = [
  { vaultId: 0, name: "Stable Yield", symbol: "USDC" },
  { vaultId: 1, name: "Euro Yield", symbol: "EURC" },
  { vaultId: 2, name: "cirBTC staking", symbol: "cirBTC" },
];

export const yieldVaultAbi = [
  {
    type: "function",
    name: "vaults",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "asset", type: "address" },
      { name: "apyBps", type: "uint256" },
      { name: "lockSeconds", type: "uint256" },
      { name: "active", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "positions",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" },
    ],
    outputs: [
      { name: "principal", type: "uint256" },
      { name: "depositedAt", type: "uint256" },
      { name: "unlocksAt", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "pendingInterest",
    stateMutability: "view",
    inputs: [
      { name: "vaultId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "vaultId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "vaultId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "event",
    name: "Deposited",
    inputs: [
      { name: "vaultId", type: "uint256", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "unlocksAt", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Withdrawn",
    inputs: [
      { name: "vaultId", type: "uint256", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "principal", type: "uint256", indexed: false },
      { name: "interest", type: "uint256", indexed: false },
    ],
  },
];
