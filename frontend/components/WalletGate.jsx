"use client";

import { useState } from "react";
import { useWallet } from "../lib/useWallet";
import { ENV } from "../lib/config";

// Gates module content behind wallet readiness. Renders actionable messages for
// every wallet state: no MetaMask, not connected, wrong network, ready.
export default function WalletGate({ children }) {
  const { status, connectMetaMask, isConnecting, switchToArc, chainId } = useWallet();
  const [error, setError] = useState(null);

  if (status === "ready") return children;

  if (status === "no-wallet") {
    return (
      <div className="card">
        <h3>MetaMask not detected</h3>
        <p className="muted">
          ArcFlow is self-custody: you sign every transaction in your own wallet. Install
          MetaMask to continue.
        </p>
        <a
          className="btn btn-primary mt-3"
          href="https://metamask.io/download/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Get MetaMask
        </a>
      </div>
    );
  }

  if (status === "disconnected") {
    return (
      <div className="card">
        <h3>Connect your wallet</h3>
        <p className="muted">Connect MetaMask to use this module on Arc Testnet.</p>
        <button
          className="btn btn-primary mt-3"
          onClick={connectMetaMask}
          disabled={isConnecting}
        >
          {isConnecting && <span className="spinner" aria-hidden="true" />}
          {isConnecting ? "Connecting…" : "Connect MetaMask"}
        </button>
      </div>
    );
  }

  // wrong-network
  return (
    <div className="card">
      <h3>Wrong network</h3>
      <p className="muted">
        This app runs on <strong>Arc Testnet</strong> (chain ID {ENV.chainId}). Your
        wallet is currently on chain ID <strong>{chainId ?? "unknown"}</strong>. Switch
        to continue. If MetaMask has an old “Arc” network with a different chain ID,
        remove it and let this button add the correct one.
      </p>
      <button
        className="btn btn-primary mt-3"
        onClick={async () => {
          setError(null);
          try {
            await switchToArc();
          } catch (e) {
            setError(e.message || "Failed to switch network.");
          }
        }}
      >
        Switch to Arc Testnet
      </button>
      {error && (
        <div className="notice notice-danger mt-3" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
