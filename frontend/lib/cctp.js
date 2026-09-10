// Circle CCTP V2 config for RailFlow's real Bridge: Arc Testnet <-> Ethereum
// Sepolia / Base Sepolia / Avalanche Fuji. Addresses, domain IDs and the Iris
// attestation API are Circle's own testnet deployment — verified against
// developers.circle.com/cctp/evm-smart-contracts (Sept 2026). TokenMessengerV2
// and MessageTransmitterV2 share the same address on every CCTP V2 testnet
// (deployed via a deterministic factory), so there's one constant for each.
export const TOKEN_MESSENGER_V2 = "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA";
export const MESSAGE_TRANSMITTER_V2 = "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275";
export const IRIS_API_BASE = "https://iris-api-sandbox.circle.com";

// "Standard Transfer": maxFee 0, waits for full finality. Circle's "Fast
// Transfer" needs a nonzero maxFee plus a per-integrator allowance, so
// Standard is what a self-serve dapp can use without extra setup.
export const FINALITY_THRESHOLD_STANDARD = 2000;
export const MAX_FEE_STANDARD = 0n;
export const BYTES32_ZERO = `0x${"0".repeat(64)}`;

export const tokenMessengerV2Abi = [
  {
    type: "function",
    name: "depositForBurn",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "burnToken", type: "address" },
      { name: "destinationCaller", type: "bytes32" },
      { name: "maxFee", type: "uint256" },
      { name: "minFinalityThreshold", type: "uint32" },
    ],
    outputs: [],
  },
];

export const messageTransmitterV2Abi = [
  {
    type: "function",
    name: "receiveMessage",
    stateMutability: "nonpayable",
    inputs: [
      { name: "message", type: "bytes" },
      { name: "attestation", type: "bytes" },
    ],
    outputs: [{ name: "success", type: "bool" }],
  },
];

// Left-pads a 20-byte EVM address into the bytes32 shape CCTP uses for
// mint recipients (the same encoding works for non-EVM destinations too).
export function addressToBytes32(address) {
  return `0x${"0".repeat(24)}${address.slice(2).toLowerCase()}`;
}

// Polls Circle's Iris attestation API for a burn tx until the message is
// attested (status "complete" with a real signature, not "PENDING").
export async function waitForAttestation(sourceDomain, txHash, { intervalMs = 4000, timeoutMs = 20 * 60 * 1000, onTick } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${IRIS_API_BASE}/v2/messages/${sourceDomain}?transactionHash=${txHash}`);
    if (res.ok) {
      const data = await res.json();
      const item = data?.messages?.[0];
      onTick?.(item);
      if (item && item.status === "complete" && item.attestation && item.attestation !== "PENDING") {
        return item;
      }
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Timed out waiting for CCTP attestation");
}
