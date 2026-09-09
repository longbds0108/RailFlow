"use client";

import { useState } from "react";
import { cx } from "../../../lib/cx";
import { TOKEN_LOGOS } from "../../../lib/logos";
import styles from "../envelope.module.css";

const SWAP_TOKENS = ["USDC", "EURC", "cirBTC"];

// Illustrative USD reference price per token — lets any of the 3 tokens be
// picked on either side and still produce a sane, internally consistent quote.
const REFERENCE_PRICE_USD = { USDC: 1, EURC: 1.157, cirBTC: 65000 };
const WALLET_BALANCE = { USDC: "30,000", EURC: "6,200", cirBTC: "0.42" };
const POOL_SPREAD = 0.9993; // pool rate sits ~0.07% below the reference rate
const SLIPPAGE_PCT = 0.003; // 0.30% max slippage

const RECENT_SWAPS = [
  { from: "USDC", to: "EURC", size: "$12,000", spread: "0.05%", when: "2h", by: "you" },
  { from: "EURC", to: "USDC", size: "$8,400", spread: "0.02%", when: "1d", by: "agent" },
  { from: "USDC", to: "cirBTC", size: "$3,200", spread: "0.18%", when: "3d", by: "you" },
];

function formatAmount(value, symbol) {
  if (!Number.isFinite(value)) return "0";
  const decimals = symbol === "cirBTC" ? 5 : 2;
  return value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// Plain (no thousands separator) string suitable for putting back into the
// editable amount input, trimmed to a sane number of decimals per token.
function toInputString(value, symbol) {
  if (!Number.isFinite(value) || value <= 0) return "";
  const decimals = symbol === "cirBTC" ? 6 : 2;
  return String(parseFloat(value.toFixed(decimals)));
}

function IconFlip() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M4 3v8M4 11 1.5 8.5M4 11l2.5-2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 12V4M11 4l2.5 2.5M11 4 8.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconDroplet() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 1.7C8 1.7 3.1 7.4 3.1 10.3A4.9 4.9 0 0 0 8 15.2A4.9 4.9 0 0 0 12.9 10.3C12.9 7.4 8 1.7 8 1.7Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function SwapPage() {
  const [fromSymbol, setFromSymbol] = useState("USDC");
  const [toSymbol, setToSymbol] = useState("EURC");
  const [amount, setAmount] = useState("5000");

  const handleAmountChange = (e) => {
    const v = e.target.value;
    if (v === "" || /^\d*\.?\d*$/.test(v)) setAmount(v);
  };

  const fromAmountNum = parseFloat(amount) || 0;
  const refRate = REFERENCE_PRICE_USD[fromSymbol] / REFERENCE_PRICE_USD[toSymbol];
  const poolRate = refRate * POOL_SPREAD;
  const toAmountNum = fromAmountNum * poolRate;
  const minReceivedNum = toAmountNum * (1 - SLIPPAGE_PCT);

  // Switching the "from" token keeps the same underlying USD value instead of
  // reinterpreting the typed number in the new unit (1,234 USDC becoming
  // "1,234 cirBTC" would be a wildly different, misleading amount).
  const handleFromChange = (symbol) => {
    if (symbol === toSymbol) setToSymbol(fromSymbol);
    const usdValue = fromAmountNum * REFERENCE_PRICE_USD[fromSymbol];
    setAmount(toInputString(usdValue / REFERENCE_PRICE_USD[symbol], symbol));
    setFromSymbol(symbol);
  };
  const handleToChange = (symbol) => {
    if (symbol === fromSymbol) setFromSymbol(toSymbol);
    setToSymbol(symbol);
  };

  // Flip carries the quoted "to" amount into the new "from" field, same as
  // any swap UI — you're now sending what you were about to receive.
  const flip = () => {
    setAmount(toInputString(toAmountNum, toSymbol));
    setFromSymbol(toSymbol);
    setToSymbol(fromSymbol);
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <span className={styles.eyebrow}>Arc Testnet · Railflow Protocol</span>
        <h1>Swap</h1>
        <p className={styles.lead}>
          Stablecoin FX on Arc. Every quote is shown against the real-world reference rate, so you can see exactly
          what the pool is charging you.
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
            Balance {WALLET_BALANCE[fromSymbol]} ·{" "}
            <button className={styles.maxLink} onClick={() => setAmount(WALLET_BALANCE[fromSymbol].replace(/,/g, ""))}>
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
            <span className={cx(styles.amountValue, styles.figures)}>{formatAmount(toAmountNum, toSymbol)}</span>
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

          <div className={styles.kvRow}>
            <span className={styles.muted}>Pool rate</span>
            <span className={styles.figures}>
              {poolRate < 1 ? poolRate.toFixed(4) : poolRate.toFixed(2)}
            </span>
          </div>
          <div className={styles.kvRow}>
            <span className={styles.muted}>Reference FX</span>
            <span className={cx(styles.figures, styles.muted)}>{refRate < 1 ? refRate.toFixed(4) : refRate.toFixed(2)}</span>
          </div>
          <div className={styles.kvRow}>
            <span className={styles.muted}>You pay vs market</span>
            <span className={cx(styles.figures, styles.kvPositive)}>0.07%</span>
          </div>

          <button className={styles.ctaButton}>Swap</button>
        </div>

        <div className={styles.sideCol}>
          <div className={styles.panel}>
            <p className={styles.panelTitle}>Route and costs</p>
            <div className={styles.kvRow}>
              <span className={styles.muted}>Venue</span>
              <span>Arc DEX pool</span>
            </div>
            <div className={styles.kvRow}>
              <span className={styles.muted}>Price impact</span>
              <span className={styles.figures}>0.04%</span>
            </div>
            <div className={styles.kvRow}>
              <span className={styles.muted}>Max slippage</span>
              <span className={styles.figures}>0.30%</span>
            </div>
            <div className={styles.kvRow}>
              <span className={styles.muted}>Minimum received</span>
              <span className={styles.figures}>
                {formatAmount(minReceivedNum, toSymbol)} {toSymbol}
              </span>
            </div>
            <div className={styles.kvRow} style={{ marginBottom: 0 }}>
              <span className={styles.muted}>Network fee</span>
              <span className={styles.figures}>$0.02</span>
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

          <div className={cx(styles.panel, styles.agentPanel)}>
            <div className={styles.agentPanelHead}>
              <span className={styles.agentMark} aria-hidden="true">✳</span>
              <p className={styles.panelTitle}>Let it run on rails</p>
            </div>
            <p className={styles.panelSub}>
              The agent watches this spread around the clock, trades only when the gap beats the cost, and never
              exceeds the slippage you signed.
            </p>
            <button className={styles.agentLink}>
              Move to agent <span className={styles.kvArrow}>→</span>
            </button>
          </div>
        </div>
      </div>

      <div className={styles.panel}>
        <p className={styles.panelTitle}>Recent swaps</p>
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span className={styles.colAsset} style={{ flex: 1.6 }}>Pair</span>
            <span className={styles.colNum}>Size</span>
            <span className={styles.colNum}>vs market</span>
            <span className={styles.colNum}>When</span>
            <span className={styles.colNum}>By</span>
          </div>
          {RECENT_SWAPS.map((s, i) => (
            <div className={styles.tableRow} key={i}>
              <span className={styles.colAsset} style={{ flex: 1.6 }}>
                <span className={styles.pairLogos}>
                  <img className={styles.tokenLogo} src={TOKEN_LOGOS[s.from]} alt="" />
                  <img className={styles.tokenLogo} src={TOKEN_LOGOS[s.to]} alt="" />
                </span>
                {s.from} → {s.to}
              </span>
              <span className={cx(styles.colNum, styles.figures, styles.muted)}>{s.size}</span>
              <span className={cx(styles.colNum, styles.figures, styles.muted)}>{s.spread}</span>
              <span className={cx(styles.colNum, styles.muted)}>{s.when}</span>
              <span className={styles.colNum}>
                <span className={cx(styles.badge, s.by === "agent" && styles.isAgent)}>
                  {s.by === "agent" ? "Agent" : "You"}
                </span>
              </span>
            </div>
          ))}
        </div>
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
