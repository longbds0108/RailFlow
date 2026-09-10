// LendingBorrowing contract: cirBTC collateral, USDC borrow, on Arc Testnet.
// Source: contracts/contracts/LendingBorrowing.sol (adapted from Circle's
// arc-defi-lend-borrow reference). Address is only set once deployed —
// components should treat an empty address as "not deployed yet" and fall
// back to the illustrative preview.
export const LENDING_ADDRESS = process.env.NEXT_PUBLIC_LENDING_ADDRESS || "";

export const lendingAbi = [
  {
    type: "function",
    name: "depositCollateral",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "withdrawCollateral",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "takeLoan",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "repayLoan",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "positions",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "collateral", type: "uint256" },
      { name: "borrowed", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "maxBorrow",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "availableToBorrow",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "collateralFactorBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "collateralPrice",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "collateralDecimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "borrowDecimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
];
