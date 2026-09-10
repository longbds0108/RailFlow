// RailFlowTBill: real NAV-appreciating tokenized bill on Arc Testnet.
// Source: contracts/contracts/RailFlowTBill.sol. Address only set once
// deployed — an empty address means no real instrument exists yet.
export const TBILL_ADDRESS = process.env.NEXT_PUBLIC_TBILL_ADDRESS || "";
export const TBILL_DEPLOYED_BLOCK = 61382149n;

export const tbillAbi = [
  { type: "function", name: "apyBps", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "currentNav", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "unitsOf", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "totalUnits", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  {
    type: "function",
    name: "subscribe",
    stateMutability: "nonpayable",
    inputs: [{ name: "usdcAmount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "redeem",
    stateMutability: "nonpayable",
    inputs: [{ name: "units", type: "uint256" }],
    outputs: [],
  },
  {
    type: "event",
    name: "Subscribed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "usdcIn", type: "uint256", indexed: false },
      { name: "unitsOut", type: "uint256", indexed: false },
      { name: "nav", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Redeemed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "unitsIn", type: "uint256", indexed: false },
      { name: "usdcOut", type: "uint256", indexed: false },
      { name: "nav", type: "uint256", indexed: false },
    ],
  },
];
