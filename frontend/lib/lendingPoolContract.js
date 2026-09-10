// RailFlowLendingPool: multi-asset money market on Arc Testnet — supply
// USDC, EURC or cirBTC as collateral, borrow any of the three against your
// combined collateral value. Source: contracts/contracts/RailFlowLendingPool.sol.
// Address is only set once deployed — components should treat an empty
// address as "not deployed yet" and fall back to the illustrative preview.
export const LENDING_POOL_ADDRESS = process.env.NEXT_PUBLIC_LENDING_POOL_ADDRESS || "";

// Block this pool was deployed at (see contracts/deployed-pool.json) — event
// queries (the agent decision log) start here instead of block 0, since
// Arc's RPC prunes old history and rejects a full-range eth_getLogs call.
export const LENDING_POOL_DEPLOYED_BLOCK = 61377451n;

// Dedicated agent keeper wallet address the debt-guardrail mandate points
// at by default — a separate identity from the connected user's own wallet,
// funded only with enough Arc gas to submit its own agentRepay() calls.
export const AGENT_ADDRESS = process.env.NEXT_PUBLIC_AGENT_ADDRESS || "";

export const lendingPoolAbi = [
  {
    type: "function",
    name: "supply",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "borrow",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "repay",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "userAssets",
    stateMutability: "view",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "address" },
    ],
    outputs: [
      { name: "supplied", type: "uint256" },
      { name: "borrowed", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "assets",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "decimals", type: "uint8" },
      { name: "priceInUsdc", type: "uint256" },
      { name: "collateralFactorBps", type: "uint256" },
      { name: "borrowable", type: "bool" },
      { name: "listed", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "accountData",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "collateralValue", type: "uint256" },
      { name: "borrowValue", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "availableToBorrowUsdc",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "setRepayMandate",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agent", type: "address" },
      { name: "repayToken", type: "address" },
      { name: "thresholdBps", type: "uint256" },
      { name: "dailyLimit", type: "uint256" },
      { name: "reserveAmount", type: "uint256" },
      { name: "expiresAt", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "revokeMandate",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "agentRepay",
    stateMutability: "nonpayable",
    inputs: [
      { name: "user", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "mandateStatus",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "agent", type: "address" },
      { name: "repayToken", type: "address" },
      { name: "thresholdBps", type: "uint256" },
      { name: "dailyLimit", type: "uint256" },
      { name: "spentToday", type: "uint256" },
      { name: "reserveAmount", type: "uint256" },
      { name: "expiresAt", type: "uint256" },
      { name: "active", type: "bool" },
      { name: "currentUtilizationBps", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "MandateSet",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "agent", type: "address", indexed: true },
      { name: "repayToken", type: "address", indexed: false },
      { name: "thresholdBps", type: "uint256", indexed: false },
      { name: "dailyLimit", type: "uint256", indexed: false },
      { name: "reserveAmount", type: "uint256", indexed: false },
      { name: "expiresAt", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MandateRevoked",
    inputs: [{ name: "user", type: "address", indexed: true }],
  },
  {
    type: "event",
    name: "AgentRepaid",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "agent", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "utilizationBpsBefore", type: "uint256", indexed: false },
      { name: "utilizationBpsAfter", type: "uint256", indexed: false },
      { name: "remainingBorrowed", type: "uint256", indexed: false },
    ],
  },
];
