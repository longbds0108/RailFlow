"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useWallet } from "../lib/useWallet";

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
  const { status } = useWallet();

  if (status === "ready") return children;

  const copy = COPY[status] || COPY.disconnected;

  return (
    <div className="card">
      <h3>{copy.title}</h3>
      <p className="muted">{copy.body}</p>
      <div className="mt-3">
        <ConnectButton />
      </div>
    </div>
  );
}
