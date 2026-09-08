"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { sepolia, baseSepolia } from "viem/chains";
import { useWallet } from "../lib/useWallet";

// Chains registered in the header's network switcher besides Arc Testnet
// (see lib/wagmi.js) — Bridge's CCTP mint step has to be signed on whichever
// of these is the destination chain, so a wallet can land here either from
// that or from switching manually.
const KNOWN_OTHER_CHAINS = {
  [sepolia.id]: sepolia.name,
  [baseSepolia.id]: baseSepolia.name,
};

const COPY = {
  "no-wallet": {
    title: "Connect a wallet",
    body: "RailFlow is self-custody: you sign every transaction in your own wallet. Connect one to continue — install a browser wallet or scan a QR code with a mobile wallet.",
  },
  disconnected: {
    title: "Connect your wallet",
    body: "Connect a wallet to use this module on Arc Testnet.",
  },
  "wrong-network": {
    title: "Wrong network",
    body: "This app runs on Arc Testnet. Switch networks to continue.",
  },
};

// Gates module content behind wallet readiness. RainbowKit's ConnectButton
// already covers not-connected, connecting, and wrong-network states, so this
// only needs to add a short explanation per status.
export default function WalletGate({ children }) {
  const { status, chainId } = useWallet();

  if (status === "ready") return children;

  const copy = COPY[status] || COPY.disconnected;
  const bridgedFrom = status === "wrong-network" ? KNOWN_OTHER_CHAINS[chainId] : null;

  return (
    <div className="card">
      <h3>{copy.title}</h3>
      <p className="muted">
        {bridgedFrom
          ? `You're connected to ${bridgedFrom} — either you switched manually, or Bridge left you here after signing CCTP's final step there. Swap runs on Arc Testnet, so switch back to continue.`
          : copy.body}
      </p>
      <div className="mt-3">
        <ConnectButton />
      </div>
    </div>
  );
}
