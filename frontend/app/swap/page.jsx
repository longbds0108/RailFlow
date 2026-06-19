"use client";

import { useMemo, useState } from "react";
import { useConfig } from "../../components/ConfigProvider";
import { useWallet } from "../../lib/useWallet";
import WalletGate from "../../components/WalletGate";
import Balances from "../../components/Balances";
import Preview from "../../components/Preview";
import TxResult from "../../components/TxResult";
import { api } from "../../lib/api";
import { appkitSwap, appkitEstimateSwap, AppKitUnavailableError } from "../../lib/appkit";
import { ammSwap, ammSupportsPair } from "../../lib/ammSwap";
import { bpsToPct } from "../../lib/format";
import { TokenLogo } from "../../components/Logo";

const ALL_TOKENS = ["USDC", "EURC", "cirBTC"];

// Arc Testnet pools are thin, so on-chain execution price drifts from Circle's
// off-chain quote. Too-tight slippage makes the swap revert ("Simulation
// failed"). Stablecoin pairs (USDC/EURC) use the config default (500 bps = 5%);
// the cirBTC pool is far thinner/mispriced so it needs a much higher tolerance.
const CIRBTC_SLIPPAGE_BPS = 5000; // 50%
const slippageFor = (tokenIn, tokenOut, base) =>
  tokenIn === "cirBTC" || tokenOut === "cirBTC" ? CIRBTC_SLIPPAGE_BPS : base;

export default function SwapPage() {
  return (
    <div>
      <h1 className="page-title">Swap</h1>
      <p className="page-subtitle">
        Same-chain swap between USDC, EURC and cirBTC on Arc Testnet via Circle App Kit.
      </p>
      <div className="row row-between" style={{ marginBottom: "var(--space-4)" }}>
        <span className="muted text-sm">Your balances</span>
        <Balances />
      </div>
      <WalletGate>
        <SwapForm />
      </WalletGate>
    </div>
  );
}

function SwapForm() {
  const { config } = useConfig();
  const { address } = useWallet();
  const baseSlippageBps = config?.swap?.defaultSlippageBps ?? 500;
  const swapPoolAddress = config?.swapPoolAddress;
  const tokens = config?.tokens;

  const [tokenIn, setTokenIn] = useState("USDC");
  const [tokenOut, setTokenOut] = useState("EURC");
  const [amountIn, setAmountIn] = useState("");
  const [phase, setPhase] = useState("form"); // form | preview | signing | recording | done | error
  const [estimate, setEstimate] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const tokenOutOptions = useMemo(
    () => ALL_TOKENS.filter((t) => t !== tokenIn),
    [tokenIn]
  );

  const slippageBps = slippageFor(tokenIn, tokenOut, baseSlippageBps);
  const isThinPair = tokenIn === "cirBTC" || tokenOut === "cirBTC";

  const valid = amountIn && Number(amountIn) > 0 && tokenIn !== tokenOut;

  const goPreview = async () => {
    setError(null);
    setResult(null);
    const est = await appkitEstimateSwap({ tokenIn, tokenOut, amountIn, slippageBps });
    setEstimate(est);
    setPhase("preview");
  };

  const confirmSwap = async () => {
    setError(null);
    setPhase("signing");
    // Hybrid routing: try Circle App Kit first; if Circle's testnet pool reverts,
    // fall back to the self-deployed RailFlow on-chain pool (USDC/EURC only).
    let route = "circle";
    try {
      let txHash, amountOut;
      try {
        ({ txHash, amountOut } = await appkitSwap({
          tokenIn,
          tokenOut,
          amountIn,
          slippageBps,
        }));
      } catch (circleErr) {
        // SDK can't run at all -> outer catch records the intent (no on-chain tx).
        if (circleErr instanceof AppKitUnavailableError) throw circleErr;
        // No fallback pool for this pair -> surface Circle's original error.
        if (!ammSupportsPair(swapPoolAddress, tokenIn, tokenOut)) throw circleErr;
        route = "railflow";
        ({ txHash, amountOut } = await ammSwap({
          address,
          tokenIn,
          tokenOut,
          amountIn,
          slippageBps,
          poolAddress: swapPoolAddress,
          tokens,
        }));
      }
      setPhase("recording");
      let record = null;
      try {
        record = await api.recordSwap({
          address,
          tokenIn,
          tokenOut,
          amountIn,
          amountOut: amountOut ?? null,
          txHash,
        });
      } catch (e) {
        // record failure shouldn't lose the on-chain success
        record = { status: "success" };
      }
      setResult({ txHash, amountOut, status: record?.status || "success", route });
      setPhase("done");
    } catch (e) {
      if (e instanceof AppKitUnavailableError) {
        try {
          await api.recordSwap({
            address,
            tokenIn,
            tokenOut,
            amountIn,
            amountOut: null,
            txHash: "0x",
          });
        } catch {
          /* ignore */
        }
        setResult({ txHash: null, status: "failed", fallback: true });
        setPhase("done");
        setError("Circle App Kit could not run here, so no on-chain swap was executed.");
        return;
      }
      setError(e.message);
      setPhase("error");
    }
  };

  const reset = () => {
    setPhase("form");
    setEstimate(null);
    setError(null);
    setResult(null);
    setAmountIn("");
  };

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <div className="field">
        <label htmlFor="tokenIn">From token</label>
        <div className="select-wrap">
          <TokenLogo symbol={tokenIn} size={18} className="select-logo" />
          <select
            id="tokenIn"
            className="select"
            value={tokenIn}
            onChange={(e) => {
              const v = e.target.value;
              setTokenIn(v);
              if (v === tokenOut) setTokenOut(ALL_TOKENS.find((t) => t !== v));
            }}
            disabled={phase !== "form"}
          >
            {ALL_TOKENS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="tokenOut">To token</label>
        <div className="select-wrap">
          <TokenLogo symbol={tokenOut} size={18} className="select-logo" />
          <select
            id="tokenOut"
            className="select"
            value={tokenOut}
            onChange={(e) => setTokenOut(e.target.value)}
            disabled={phase !== "form"}
          >
            {tokenOutOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="amountIn">Amount in ({tokenIn})</label>
        <input
          id="amountIn"
          className="input"
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          placeholder="0.00"
          value={amountIn}
          onChange={(e) => setAmountIn(e.target.value)}
          disabled={phase !== "form"}
        />
      </div>

      <div className="kv">
        <dt>Slippage tolerance</dt>
        <dd>{bpsToPct(slippageBps)}</dd>
      </div>
      {isThinPair && (
        <p className="text-xs muted" style={{ marginTop: "var(--space-2)" }}>
          cirBTC has a thin testnet pool, so a high slippage tolerance is used to let
          the swap go through.
        </p>
      )}
      {ammSupportsPair(swapPoolAddress, tokenIn, tokenOut) && (
        <p className="text-xs muted" style={{ marginTop: "var(--space-2)" }}>
          Routed via Circle App Kit — if Circle&apos;s testnet pool is unavailable, the
          swap automatically falls back to the on-chain RailFlow pool.
        </p>
      )}

      {phase === "form" && (
        <button
          className="btn btn-primary btn-block mt-4"
          onClick={goPreview}
          disabled={!valid}
        >
          Review swap
        </button>
      )}

      {phase !== "form" && phase !== "done" && (
        <Preview
          title="Review swap"
          rows={[
            { label: "From", value: `${amountIn} ${tokenIn}` },
            {
              label: "To (estimated)",
              value: estimate?.estimatedOutput?.amount
                ? `${estimate.estimatedOutput.amount} ${tokenOut}`
                : `~ ${tokenOut}`,
            },
            {
              label: "Minimum received",
              value: estimate?.stopLimit?.amount
                ? `${estimate.stopLimit.amount} ${tokenOut}`
                : "—",
            },
            { label: "Slippage", value: bpsToPct(slippageBps) },
            { label: "Network", value: "Arc Testnet" },
          ]}
        >
          <div className="row mt-4">
            <button
              className="btn btn-primary"
              onClick={confirmSwap}
              disabled={phase === "signing" || phase === "recording"}
            >
              {(phase === "signing" || phase === "recording") && (
                <span className="spinner" aria-hidden="true" />
              )}
              {phase === "signing"
                ? "Confirm in MetaMask…"
                : phase === "recording"
                  ? "Recording…"
                  : "Confirm swap"}
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
          title={result.status === "failed" ? "Swap not completed" : "Swap submitted"}
          hash={result.txHash}
          note={result.fallback ? error : undefined}
        >
          <div className="text-sm">
            {amountIn} {tokenIn} →{" "}
            {result.amountOut ? `${result.amountOut} ${tokenOut}` : tokenOut} ·{" "}
            <span className="badge badge-info">{result.status}</span>
            {result.route && (
              <span className="badge" style={{ marginLeft: "var(--space-2)" }}>
                {result.route === "railflow" ? "via RailFlow pool" : "via Circle"}
              </span>
            )}
          </div>
          <button className="btn btn-ghost btn-sm mt-3" onClick={reset}>
            New swap
          </button>
        </TxResult>
      )}
    </div>
  );
}
