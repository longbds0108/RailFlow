"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { useConfig } from "../../components/ConfigProvider";
import { useWallet, useBalances } from "../../lib/useWallet";
import WalletGate from "../../components/WalletGate";
import Preview from "../../components/Preview";
import TxResult from "../../components/TxResult";
import TokenSidebar from "../../components/TokenSidebar";
import { api } from "../../lib/api";
import { appkitSwap, appkitEstimateSwap, AppKitUnavailableError } from "../../lib/appkit";
import { ammSwap, ammSupportsPair, ammEstimateSwap } from "../../lib/ammSwap";
import { bpsToPct, fmtAmount, fmtNumber } from "../../lib/format";
import { TokenLogo } from "../../components/Logo";

const ALL_TOKENS = ["USDC", "EURC", "cirBTC"];

// Arc Testnet pools are thin, so on-chain execution price drifts from Circle's
// off-chain quote. Too-tight slippage makes the swap revert ("Simulation
// failed"). Stablecoin pairs (USDC/EURC) use the config default (500 bps = 5%);
// the cirBTC pool is far thinner/mispriced so it needs a much higher tolerance.
const CIRBTC_SLIPPAGE_BPS = 5000; // 50%
const slippageFor = (tokenIn, tokenOut, base) =>
  tokenIn === "cirBTC" || tokenOut === "cirBTC" ? CIRBTC_SLIPPAGE_BPS : base;

// User-facing slippage presets (bps). Kept modest since it's the tolerance for
// non-cirBTC pairs — cirBTC always overrides to CIRBTC_SLIPPAGE_BPS above.
const SLIPPAGE_PRESETS = [100, 500, 1000]; // 1% / 5% / 10%

export default function SwapPage() {
  return (
    <div>
      <h1 className="page-title">Swap</h1>
      <p className="page-subtitle">
        Same-chain swap between USDC, EURC and cirBTC on Arc Testnet via Circle App Kit.
      </p>
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
  const [userSlippageBps, setUserSlippageBps] = useState(null); // null = use config default
  const [slippageOpen, setSlippageOpen] = useState(false);

  const { balances } = useBalances(address);
  const fromBalance = balances[tokenIn];

  const tokenOutOptions = useMemo(
    () => ALL_TOKENS.filter((t) => t !== tokenIn),
    [tokenIn]
  );

  const chosenSlippageBps = userSlippageBps ?? baseSlippageBps;
  const slippageBps = slippageFor(tokenIn, tokenOut, chosenSlippageBps);
  const isThinPair = tokenIn === "cirBTC" || tokenOut === "cirBTC";

  const valid = amountIn && Number(amountIn) > 0 && tokenIn !== tokenOut;

  // Live quote while typing (debounced) — purely informational, doesn't
  // change phase. goPreview() below still fetches its own fresh quote right
  // before the explicit confirm step.
  useEffect(() => {
    if (phase !== "form" || !valid) {
      setEstimate(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      // Circle's testnet quote is best-effort and often unavailable; fall
      // back to the RailFlow pool's real on-chain reserves (read-only, no
      // wallet needed) so "To (estimated)" shows a genuine number rather
      // than a dash whenever the pair has real fallback liquidity.
      let est = await appkitEstimateSwap({ tokenIn, tokenOut, amountIn, slippageBps });
      if (!est?.estimatedOutput?.amount) {
        est = await ammEstimateSwap({ tokenIn, tokenOut, amountIn, poolAddress: swapPoolAddress, tokens });
      }
      if (!cancelled) setEstimate(est);
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenIn, tokenOut, amountIn, slippageBps, phase]);

  const flip = () => {
    if (phase !== "form") return;
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setEstimate(null);
  };

  const setMax = () => {
    if (!fromBalance || fromBalance.raw === "0") return;
    setAmountIn(formatUnits(BigInt(fromBalance.raw), fromBalance.decimals));
  };

  const goPreview = async () => {
    setError(null);
    setResult(null);
    let est = await appkitEstimateSwap({ tokenIn, tokenOut, amountIn, slippageBps });
    if (!est?.estimatedOutput?.amount) {
      est = await ammEstimateSwap({ tokenIn, tokenOut, amountIn, poolAddress: swapPoolAddress, tokens });
    }
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
    setSlippageOpen(false);
  };

  const rate =
    estimate?.estimatedOutput?.amount && Number(amountIn) > 0
      ? Number(estimate.estimatedOutput.amount) / Number(amountIn)
      : null;

  return (
    <div className="grid grid-cols-3" style={{ gridTemplateColumns: "1.3fr 1fr", alignItems: "start" }}>
      <div className="card">
        <div className="row row-between" style={{ marginBottom: "var(--space-4)" }}>
          <h3 style={{ fontSize: "var(--text-lg)", margin: 0 }}>Swap Tokens</h3>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setSlippageOpen((o) => !o)}
            style={{ borderRadius: "var(--radius-pill)" }}
            aria-expanded={slippageOpen}
          >
            ⚙ {bpsToPct(chosenSlippageBps)} slippage
          </button>
        </div>

        {slippageOpen && (
          <div className="row" style={{ gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
            {SLIPPAGE_PRESETS.map((bps) => {
              const active = chosenSlippageBps === bps;
              return (
                <button
                  key={bps}
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setUserSlippageBps(bps)}
                  disabled={phase !== "form"}
                  style={{
                    flex: 1,
                    background: active ? "var(--color-surface-2)" : "var(--color-bg-elev)",
                    border: active ? "1px solid var(--color-primary)" : "1px solid var(--color-border-strong)",
                    color: active ? "var(--color-text)" : "var(--color-text-muted)",
                    fontWeight: active ? 700 : 500,
                  }}
                >
                  {bpsToPct(bps)}
                </button>
              );
            })}
          </div>
        )}

        <div className="swap-panel">
          <div className="swap-panel-label">From</div>
          <div className="swap-amount-row">
            <input
              className="swap-amount-input"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              placeholder="0.00"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              disabled={phase !== "form"}
              aria-label={`Amount in ${tokenIn}`}
            />
            <TokenPillSelect
              value={tokenIn}
              onChange={(v) => {
                setTokenIn(v);
                if (v === tokenOut) setTokenOut(ALL_TOKENS.find((t) => t !== v));
              }}
              options={ALL_TOKENS}
              disabled={phase !== "form"}
            />
          </div>
          <div className="swap-meta-row">
            <span className="muted">
              Balance: {fromBalance ? fmtAmount(fromBalance.raw, fromBalance.decimals) : "…"} {tokenIn}
            </span>
            <button
              type="button"
              className="swap-max-btn"
              onClick={setMax}
              disabled={phase !== "form" || !fromBalance || fromBalance.raw === "0"}
            >
              MAX
            </button>
          </div>
        </div>

        <div className="swap-flip-row">
          <button
            type="button"
            className="swap-flip-btn"
            onClick={flip}
            disabled={phase !== "form"}
            aria-label="Reverse swap direction"
          >
            ⇅
          </button>
        </div>

        <div className="swap-panel">
          <div className="swap-panel-label">To (estimated)</div>
          <div className="swap-amount-row">
            <div className={`swap-amount-display${estimate?.estimatedOutput?.amount ? "" : " is-empty"}`}>
              {estimate?.estimatedOutput?.amount || "—"}
            </div>
            <TokenPillSelect
              value={tokenOut}
              onChange={setTokenOut}
              options={tokenOutOptions}
              disabled={phase !== "form"}
            />
          </div>
        </div>

        {rate && (
          <div className="swap-panel mt-4">
            <div className="kv">
              <dt>Rate</dt>
              <dd>
                1 {tokenIn} ≈ {fmtNumber(rate, 6)} {tokenOut}
              </dd>
            </div>
          </div>
        )}
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
            Swap {tokenIn} → {tokenOut}
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

      <TokenSidebar />
    </div>
  );
}

function TokenPillSelect({ value, onChange, options, disabled }) {
  return (
    <div className="token-pill">
      <TokenLogo symbol={value} size={22} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label="Token"
      >
        {options.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </div>
  );
}
