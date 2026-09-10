"use client";

import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { useSwitchChain } from "wagmi";
import { cx } from "../../../lib/cx";
import { TOKEN_LOGOS } from "../../../lib/logos";
import { TOKENS, ENV, explorerTxUrl } from "../../../lib/config";
import { useWallet } from "../../../lib/useWallet";
import { AMM_ADDRESS } from "../../../lib/ammSwap";
import { useSwapBalances, useSwapQuote, useExecuteSwap, useSwapHistory } from "../../../lib/useSwapAmm";
import { IconFlip, IconDroplet, IconRoute, IconHistory } from "../../../components/icons";
import styles from "../envelope.module.css";

const SWAP_TOKENS = ["USDC", "EURC", "cirBTC"];

function formatAmount(value, symbol) {
  if (!Number.isFinite(value)) return "0";
  const decimals = symbol === "cirBTC" ? 5 : 2;
  return value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function SwapPage() {
  const { address, isConnected, correctNetwork } = useWallet();
  const { switchChain, isPending: switchingChain } = useSwitchChain();
  const [refreshKey, setRefreshKey] = useState(0);
  const [fromSymbol, setFromSymbol] = useState("USDC");
  const [toSymbol, setToSymbol] = useState("EURC");
  const [amount, setAmount] = useState("");

  const { balances } = useSwapBalances(address, refreshKey);
  const { quote } = useSwapQuote(fromSymbol, toSymbol, amount, refreshKey);
  const { execute, status, error, txHash, reset, isBusy } = useExecuteSwap();
  const { entries: history } = useSwapHistory(address, refreshKey);

  useEffect(() => {
    if (status === "done") {
      setRefreshKey((k) => k + 1);
      setAmount("");
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const handleAmountChange = (e) => {
    const v = e.target.value;
    if (v === "" || /^\d*\.?\d*$/.test(v)) setAmount(v);
  };
  const handleFromChange = (symbol) => {
    if (symbol === toSymbol) setToSymbol(fromSymbol);
    setFromSymbol(symbol);
    setAmount("");
  };
  const handleToChange = (symbol) => {
    if (symbol === fromSymbol) setFromSymbol(toSymbol);
    setToSymbol(symbol);
  };
  const flip = () => {
    const outNum = quote?.amountOut ? Number(formatUnits(quote.amountOut, TOKENS[toSymbol].decimals)) : 0;
    setAmount(outNum > 0 ? String(outNum) : "");
    setFromSymbol(toSymbol);
    setToSymbol(fromSymbol);
  };

  const fromBalanceRaw = balances[fromSymbol]?.balance ?? null;
  const fromAmountNum = parseFloat(amount) || 0;
  const outDecimals = TOKENS[toSymbol].decimals;
  const inDecimals = TOKENS[fromSymbol].decimals;
  const amountOutNum = quote?.amountOut ? Number(formatUnits(quote.amountOut, outDecimals)) : 0;

  // Real price impact: compare the actual quoted output to what a frictionless
  // trade at the pool's current spot rate (no fee, no slippage) would give.
  let priceImpactPct = null;
  let spotRate = null;
  if (quote?.hasLiquidity) {
    const reserveInNum = Number(formatUnits(quote.reserveIn, inDecimals));
    const reserveOutNum = Number(formatUnits(quote.reserveOut, outDecimals));
    spotRate = reserveOutNum / reserveInNum;
    const linearOut = fromAmountNum * spotRate;
    priceImpactPct = linearOut > 0 ? ((linearOut - amountOutNum) / linearOut) * 100 : 0;
  }

  const SLIPPAGE_BPS = 100; // 1% — wider than a deep-liquidity DEX since this pool is thinly seeded
  const minReceivedNum = amountOutNum * (1 - SLIPPAGE_BPS / 10_000);

  const amountInRaw = (() => {
    try {
      if (!amount || fromAmountNum <= 0) return 0n;
      return BigInt(Math.round(fromAmountNum * 10 ** inDecimals));
    } catch {
      return 0n;
    }
  })();
  const insufficientBalance = fromBalanceRaw != null && amountInRaw > fromBalanceRaw;
  const noLiquidity = amountInRaw > 0n && quote && !quote.hasLiquidity;
  const canSwap = isConnected && amountInRaw > 0n && !insufficientBalance && quote?.hasLiquidity && amountOutNum > 0 && !isBusy;

  const handleSwap = () => {
    if (!canSwap || !address) return;
    execute({ address, tokenIn: fromSymbol, tokenOut: toSymbol, amountIn: amount, slippageBps: SLIPPAGE_BPS });
  };

  const primaryLabel = status === "approving" ? "Confirm approval…" : status === "swapping" ? "Confirm in wallet…" : "Swap";

  if (!isConnected || !correctNetwork) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHead}>
          <span className={styles.eyebrow}>Arc Testnet · Railflow Protocol</span>
          <h1>Swap</h1>
          <p className={styles.lead}>Real on-chain swaps between USDC, EURC and cirBTC via RailFlowAMM.</p>
        </div>
        <div className={styles.noteBanner}>
          <p className={styles.noteText}>
            {!isConnected
              ? "Connect your wallet to see real balances and swap."
              : "Swap runs on Arc Testnet — the network your wallet is on doesn't have this contract."}
          </p>
          {isConnected && !correctNetwork && (
            <button
              className={styles.ctaButton}
              style={{ marginTop: 12, width: "auto", padding: "8px 16px" }}
              onClick={() => switchChain({ chainId: ENV.chainId })}
              disabled={switchingChain}
            >
              {switchingChain ? "Switching…" : "Switch to Arc Testnet"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <span className={styles.eyebrow}>Arc Testnet · Railflow Protocol</span>
        <h1>Swap</h1>
        <p className={styles.lead}>
          Real constant-product swaps on RailFlowAMM. Quotes come straight from the pool's own on-chain reserves —
          pairs with no seeded liquidity yet show that honestly instead of a made-up rate.
        </p>
      </div>

      <div className={cx(styles.twoColGrid, "swapGrid")}>
        <div className={cx(styles.panel, styles.elevated)}>
          <p className={styles.statLabel} style={{ marginBottom: 6 }}>From</p>
          <div className={styles.amountBox}>
            <input
              className={styles.amountInput}
              value={amount}
              onChange={handleAmountChange}
              inputMode="decimal"
              placeholder="0"
              aria-label={`Amount of ${fromSymbol} to swap`}
            />
            <span className={styles.amountToken}>
              <img className={styles.tokenLogo} src={TOKEN_LOGOS[fromSymbol]} alt="" />
              <select
                className={styles.tokenSelect}
                value={fromSymbol}
                onChange={(e) => handleFromChange(e.target.value)}
                aria-label="From token"
              >
                {SWAP_TOKENS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </span>
          </div>
          <p className={styles.walletNote}>
            Balance {fromBalanceRaw != null ? formatAmount(Number(formatUnits(fromBalanceRaw, inDecimals)), fromSymbol) : "—"} ·{" "}
            <button
              className={styles.maxLink}
              disabled={fromBalanceRaw == null}
              onClick={() => setAmount(formatUnits(fromBalanceRaw, inDecimals))}
            >
              Max
            </button>
          </p>

          <div style={{ display: "flex", justifyContent: "center", margin: "-4px 0 2px" }}>
            <button className={styles.iconButton} onClick={flip} aria-label="Flip swap direction">
              <IconFlip />
            </button>
          </div>

          <p className={styles.statLabel} style={{ margin: "10px 0 6px" }}>To</p>
          <div className={styles.amountBox} style={{ marginBottom: 14 }}>
            <span className={cx(styles.amountValue, styles.figures)}>{formatAmount(amountOutNum, toSymbol)}</span>
            <span className={styles.amountToken}>
              <img className={styles.tokenLogo} src={TOKEN_LOGOS[toSymbol]} alt="" />
              <select
                className={styles.tokenSelect}
                value={toSymbol}
                onChange={(e) => handleToChange(e.target.value)}
                aria-label="To token"
              >
                {SWAP_TOKENS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </span>
          </div>

          {noLiquidity ? (
            <p style={{ fontSize: 12, color: "var(--text-warning)", margin: "0 0 14px" }}>
              No liquidity seeded for {fromSymbol}/{toSymbol} yet — this pair can't quote a real rate.
            </p>
          ) : (
            <>
              <div className={styles.kvRow}>
                <span className={styles.muted}>Pool rate</span>
                <span className={styles.figures}>{spotRate != null ? (spotRate < 1 ? spotRate.toFixed(4) : spotRate.toFixed(2)) : "—"}</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.muted}>Price impact</span>
                <span className={cx(styles.figures, priceImpactPct > 1 && styles.kvNegative)}>
                  {priceImpactPct != null ? `${priceImpactPct.toFixed(2)}%` : "—"}
                </span>
              </div>
            </>
          )}
          {insufficientBalance && (
            <p style={{ fontSize: 11, color: "var(--text-danger)", marginTop: -8, marginBottom: 12 }}>
              Amount exceeds your {fromSymbol} balance.
            </p>
          )}

          <button className={styles.ctaButton} onClick={handleSwap} disabled={!canSwap}>
            {primaryLabel}
          </button>
          {error && <p style={{ fontSize: 11, color: "var(--text-danger)", marginTop: 8 }}>{error}</p>}
        </div>

        <div className={styles.sideCol}>
          <div className={styles.panel}>
            <div className={styles.panelTitleRow}>
              <span className={styles.panelTitleIcon}>
                <IconRoute size={16} />
              </span>
              <p className={styles.panelTitle}>Route and costs</p>
            </div>
            <div className={styles.kvRow}>
              <span className={styles.muted}>Venue</span>
              <span>RailFlowAMM</span>
            </div>
            <div className={styles.kvRow}>
              <span className={styles.muted}>Swap fee</span>
              <span className={styles.figures}>0.30%</span>
            </div>
            <div className={styles.kvRow}>
              <span className={styles.muted}>Max slippage</span>
              <span className={styles.figures}>{(SLIPPAGE_BPS / 100).toFixed(2)}%</span>
            </div>
            <div className={styles.kvRow} style={{ marginBottom: 0 }}>
              <span className={styles.muted}>Minimum received</span>
              <span className={styles.figures}>
                {quote?.hasLiquidity ? `${formatAmount(minReceivedNum, toSymbol)} ${toSymbol}` : "—"}
              </span>
            </div>
          </div>

          <div className={styles.tipBanner}>
            <span className={styles.tipIcon}>
              <IconDroplet />
            </span>
            <div>
              <p className={styles.tipTitle}>Need testnet tokens?</p>
              <p className={styles.tipText}>
                Get free USDC and EURC from the Circle Faucet.
                <br />
                <a className={styles.tipLink} href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer">
                  faucet.circle.com <span aria-hidden="true">↗</span>
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.panelTitleRow}>
          <span className={styles.panelTitleIcon}>
            <IconHistory size={16} />
          </span>
          <p className={styles.panelTitle}>Your swap history</p>
        </div>
        {history.length === 0 ? (
          <p className={styles.panelSub}>No swaps yet — real trades through RailFlowAMM will show up here.</p>
        ) : (
          <div className={styles.table}>
            <div className={styles.tableHead}>
              <span className={styles.colAsset} style={{ flex: 1.6 }}>Pair</span>
              <span className={styles.colNum}>Sent</span>
              <span className={styles.colNum}>Received</span>
              <span className={styles.colNum}>When</span>
              <span className={styles.colNum}>Tx</span>
            </div>
            {history.map((s) => (
              <div className={styles.tableRow} key={s.txHash}>
                <span className={styles.colAsset} style={{ flex: 1.6 }}>
                  <span className={styles.pairLogos}>
                    <img className={styles.tokenLogo} src={TOKEN_LOGOS[s.fromSymbol]} alt="" />
                    <img className={styles.tokenLogo} src={TOKEN_LOGOS[s.toSymbol]} alt="" />
                  </span>
                  {s.fromSymbol} → {s.toSymbol}
                </span>
                <span className={cx(styles.colNum, styles.figures, styles.muted)}>
                  {formatAmount(Number(formatUnits(s.amountIn, TOKENS[s.fromSymbol].decimals)), s.fromSymbol)}
                </span>
                <span className={cx(styles.colNum, styles.figures)}>
                  {formatAmount(Number(formatUnits(s.amountOut, TOKENS[s.toSymbol].decimals)), s.toSymbol)}
                </span>
                <span className={cx(styles.colNum, styles.muted)}>{new Date(s.timestamp).toLocaleDateString()}</span>
                <span className={styles.colNum}>
                  <a className={styles.linkButton} href={explorerTxUrl(s.txHash)} target="_blank" rel="noopener noreferrer">
                    View
                  </a>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .swapGrid {
          max-width: 820px;
          margin: 0 auto;
          grid-template-columns: 440px minmax(280px, 1fr);
        }
        @media (max-width: 860px) {
          .swapGrid {
            max-width: 100%;
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
