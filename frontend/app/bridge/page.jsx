"use client";

import { useState } from "react";
import { useConfig } from "../../components/ConfigProvider";
import { useWallet } from "../../lib/useWallet";
import WalletGate from "../../components/WalletGate";
import Balances from "../../components/Balances";
import Preview from "../../components/Preview";
import TxResult from "../../components/TxResult";
import StatusBadge from "../../components/StatusBadge";
import { api } from "../../lib/api";
import { appkitBridge, AppKitUnavailableError } from "../../lib/appkit";
import { TokenLogo, ChainLogo } from "../../components/Logo";

export default function BridgePage() {
  return (
    <div>
      <h1 className="page-title">Bridge</h1>
      <p className="page-subtitle">
        Move USDC across chains using Circle CCTP. Cross-chain bridges can take a few
        minutes to finalize.
      </p>
      <div className="row row-between" style={{ marginBottom: "var(--space-4)" }}>
        <span className="muted text-sm">Your balances (Arc)</span>
        <Balances />
      </div>
      <WalletGate>
        <BridgeForm />
      </WalletGate>
    </div>
  );
}

function BridgeForm() {
  const { config } = useConfig();
  const { address } = useWallet();
  const chains = config?.bridge?.supportedChains || [];
  const tokens = config?.bridge?.tokens || ["USDC"];

  const [fromChain, setFromChain] = useState(chains[0]?.appKitName || "Arc_Testnet");
  const [toChain, setToChain] = useState(chains[1]?.appKitName || "Ethereum_Sepolia");
  const [token, setToken] = useState(tokens[0] || "USDC");
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState("form"); // form | preview | signing | recording | done | error
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const label = (name) => chains.find((c) => c.appKitName === name)?.label || name;
  const valid = amount && Number(amount) > 0 && fromChain !== toChain;

  const confirm = async () => {
    setError(null);
    setPhase("signing");
    try {
      const { srcTxHash, state, steps } = await appkitBridge({
        fromChain,
        toChain,
        amount,
        token,
      });
      setPhase("recording");
      let record = null;
      try {
        record = await api.recordBridge({
          address,
          fromChain,
          toChain,
          token,
          amount,
          srcTxHash,
        });
      } catch {
        record = { status: state === "success" ? "completed" : "pending_source" };
      }
      setResult({ srcTxHash, status: record?.status, state, steps });
      setPhase("done");
    } catch (e) {
      if (e instanceof AppKitUnavailableError) {
        try {
          await api.recordBridge({
            address,
            fromChain,
            toChain,
            token,
            amount,
            srcTxHash: "0x",
          });
        } catch {
          /* ignore */
        }
        setResult({ srcTxHash: null, status: "failed", fallback: true });
        setPhase("done");
        setError("Circle App Kit could not run here, so no on-chain bridge was started.");
        return;
      }
      setError(e.message);
      setPhase("error");
    }
  };

  const reset = () => {
    setPhase("form");
    setError(null);
    setResult(null);
    setAmount("");
  };

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <div className="row" style={{ gap: "var(--space-4)", alignItems: "flex-end" }}>
        <div className="field" style={{ flex: 1, marginBottom: 0 }}>
          <label htmlFor="fromChain">From chain</label>
          <div className="select-wrap">
            <ChainLogo name={fromChain} size={18} className="select-logo" />
            <select
              id="fromChain"
              className="select"
              value={fromChain}
              onChange={(e) => {
                const v = e.target.value;
                setFromChain(v);
                if (v === toChain) {
                  setToChain(chains.find((c) => c.appKitName !== v)?.appKitName);
                }
              }}
              disabled={phase !== "form"}
            >
              {chains.map((c) => (
                <option key={c.appKitName} value={c.appKitName}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field" style={{ flex: 1, marginBottom: 0 }}>
          <label htmlFor="toChain">To chain</label>
          <div className="select-wrap">
            <ChainLogo name={toChain} size={18} className="select-logo" />
            <select
              id="toChain"
              className="select"
              value={toChain}
              onChange={(e) => setToChain(e.target.value)}
              disabled={phase !== "form"}
            >
              {chains
                .filter((c) => c.appKitName !== fromChain)
                .map((c) => (
                  <option key={c.appKitName} value={c.appKitName}>
                    {c.label}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      <div className="field mt-4">
        <label htmlFor="bridgeToken">Token</label>
        <div className="select-wrap">
          <TokenLogo symbol={token} size={18} className="select-logo" />
          <select
            id="bridgeToken"
            className="select"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={phase !== "form"}
          >
            {tokens.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="bridgeAmount">Amount ({token})</label>
        <input
          id="bridgeAmount"
          className="input"
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={phase !== "form"}
        />
      </div>

      {phase === "form" && (
        <button
          className="btn btn-primary btn-block mt-3"
          onClick={() => setPhase("preview")}
          disabled={!valid}
        >
          Review bridge
        </button>
      )}

      {phase !== "form" && phase !== "done" && (
        <Preview
          title="Review bridge"
          rows={[
            { label: "From", value: label(fromChain) },
            { label: "To", value: label(toChain) },
            { label: "Token", value: token },
            { label: "Amount", value: `${amount} ${token}` },
            { label: "Protocol", value: "Circle CCTP" },
          ]}
        >
          <div className="notice notice-info mt-3" role="note">
            Bridging is asynchronous — funds arrive on the destination chain after
            attestation. You may sign more than one transaction.
          </div>
          <div className="row mt-4">
            <button
              className="btn btn-primary"
              onClick={confirm}
              disabled={phase === "signing" || phase === "recording"}
            >
              {(phase === "signing" || phase === "recording") && (
                <span className="spinner" aria-hidden="true" />
              )}
              {phase === "signing"
                ? "Confirm in MetaMask…"
                : phase === "recording"
                  ? "Recording…"
                  : "Confirm bridge"}
            </button>
            <button
              className="btn btn-ghost"
              onClick={reset}
              disabled={phase === "signing" || phase === "recording"}
            >
              Cancel
            </button>
          </div>
        </Preview>
      )}

      {error && phase === "error" && (
        <div className="notice notice-danger mt-4" role="alert">
          {error}
        </div>
      )}

      {phase === "done" && result && (
        <TxResult
          kind={result.status === "failed" ? "danger" : "success"}
          title={result.status === "failed" ? "Bridge not started" : "Bridge initiated"}
          hash={result.srcTxHash}
          note={result.fallback ? error : undefined}
        >
          <div className="text-sm">
            {amount} {token}: {label(fromChain)} → {label(toChain)} ·{" "}
            <StatusBadge status={result.status || result.state} />
          </div>
          {result.steps && result.steps.length > 0 && (
            <ul className="text-xs muted mt-3" style={{ paddingLeft: "var(--space-4)" }}>
              {result.steps.map((s, i) => (
                <li key={i}>
                  {s.name}: {s.state}
                </li>
              ))}
            </ul>
          )}
          <button className="btn btn-ghost btn-sm mt-3" onClick={reset}>
            New bridge
          </button>
        </TxResult>
      )}
    </div>
  );
}
