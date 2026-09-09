"use client";

import { useState } from "react";
import { cx } from "../../../lib/cx";
import { TOKEN_LOGOS } from "../../../lib/logos";
import styles from "../envelope.module.css";

const MARKETS = [
  {
    symbol: "USDC",
    logo: TOKEN_LOGOS.USDC,
    supplyApy: "6.20%",
    borrowApy: "8.10%",
    util: 74,
    ltv: "90%",
    walletBalance: "4,100",
    amount: "5,000",
    healthAfter: "3.11",
  },
  {
    symbol: "EURC",
    logo: TOKEN_LOGOS.EURC,
    supplyApy: "4.20%",
    borrowApy: "6.30%",
    util: 58,
    ltv: "85%",
    walletBalance: "2,400",
    amount: "2,000",
    healthAfter: "3.02",
  },
  {
    symbol: "cirBTC",
    logo: TOKEN_LOGOS.cirBTC,
    supplyApy: "2.76%",
    borrowApy: "4.90%",
    util: 41,
    ltv: "70%",
    walletBalance: "0.18",
    amount: "0.05",
    healthAfter: "2.95",
  },
];

const POSITIONS = [
  { symbol: "USDC", supplied: "$30,000", apy: "6.20%", managedBy: "you" },
  { symbol: "cirBTC", supplied: "$14,100", apy: "2.76%", managedBy: "you" },
  { symbol: "USDC", supplied: "$24,100", apy: "6.20%", managedBy: "agent" },
];

const HEALTH_FACTOR = 2.84;
const HEALTH_MAX = 3.5;
const healthZone = HEALTH_FACTOR >= 1.8 ? "safe" : HEALTH_FACTOR >= 1.2 ? "caution" : "risk";
const healthPct = Math.min(100, (HEALTH_FACTOR / HEALTH_MAX) * 100);
const ZONE_CLASS = { safe: styles.zoneSafe, caution: styles.zoneCaution, risk: styles.zoneRisk };

function IconLayers() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M9 2.3 16 6.3 9 10.3 2 6.3 9 2.3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M2 9.6 9 13.6 16 9.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M9 1.6 15.4 4 15.4 8.6C15.4 12.5 12.6 15.2 9 16.4 5.4 15.2 2.6 12.5 2.6 8.6L2.6 4 9 1.6Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M6.1 9 8.2 11 12 6.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPercent() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="5.4" cy="5.4" r="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12.6" cy="12.6" r="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13.5 3.5 4.5 14.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

const STAT_TILES = [
  { key: "collateral", label: "My collateral", value: "$44,100", icon: <IconLayers /> },
  { key: "health", label: "Health factor", value: HEALTH_FACTOR.toFixed(2), icon: <IconShield />, gauge: true },
  { key: "apy", label: "USDC supply APY", value: "6.20%", icon: <IconPercent /> },
  { key: "agent", label: "In agent vault", value: "$48,200", icon: <span aria-hidden="true">✳</span> },
];

export default function LendPage() {
  const [tokenIndex, setTokenIndex] = useState(0);
  const [mode, setMode] = useState("supply");
  const token = MARKETS[tokenIndex];

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <span className={styles.eyebrow}>Arc Testnet · Railflow Protocol</span>
        <h1>Lend</h1>
        <p className={styles.lead}>
          Supply USDC, EURC or cirBTC from your own wallet. You sign every action here, or hand the sleeve to the
          agent instead.
        </p>
      </div>

      <div className={styles.statGrid}>
        {STAT_TILES.map((tile) => (
          <div className={styles.statTile} key={tile.key}>
            <div className={styles.statIcon} style={{ color: "var(--text-accent)" }}>
              {tile.icon}
            </div>
            <div className={styles.statBody}>
              <p className={styles.statLabel}>{tile.label}</p>
              <p className={styles.statValue} style={{ color: tile.key === "health" ? "var(--text-success)" : "var(--text-primary)" }}>
                {tile.value}
              </p>
              {tile.gauge && (
                <div className={styles.healthGauge} aria-hidden="true">
                  <span className={cx(styles.healthGaugeFill, ZONE_CLASS[healthZone])} style={{ width: `${healthPct}%` }} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.twoColGrid}>
        <div className={styles.panel}>
          <p className={styles.panelTitle}>Supply markets</p>
          <p className={styles.panelSub}>All three assets earn yield and can be used as collateral.</p>
          <div className={styles.table}>
            <div className={styles.tableHead}>
              <span className={styles.colAsset}>Asset</span>
              <span className={styles.colNum}>Supply</span>
              <span className={styles.colNum}>Borrow</span>
              <span className={styles.colNum}>Util</span>
              <span className={styles.colLtv}>LTV</span>
            </div>
            {MARKETS.map((m, i) => (
              <button
                key={m.symbol}
                className={cx(styles.tableRow, i === tokenIndex && styles.isSelected)}
                onClick={() => setTokenIndex(i)}
              >
                <span className={styles.colAsset}>
                  <img className={styles.tokenLogo} src={m.logo} alt="" />
                  {m.symbol}
                </span>
                <span className={cx(styles.colNum, styles.figures)}>{m.supplyApy}</span>
                <span className={cx(styles.colNum, styles.figures, styles.muted)}>{m.borrowApy}</span>
                <span className={cx(styles.colNum, styles.figures, styles.muted)}>{m.util}%</span>
                <span className={cx(styles.colLtv, styles.muted)}>{m.ltv}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.sideCol}>
          <div className={cx(styles.panel, styles.elevated)}>
            <div className={styles.tokenTabs}>
              {MARKETS.map((m, i) => (
                <button
                  key={m.symbol}
                  className={cx(styles.tokenChip, i === tokenIndex && styles.isActive)}
                  onClick={() => setTokenIndex(i)}
                >
                  <img className={styles.tokenChipLogo} src={m.logo} alt="" />
                  {m.symbol}
                </button>
              ))}
            </div>

            <div className={styles.segmented}>
              {["supply", "withdraw"].map((m) => (
                <button key={m} className={cx(styles.segment, mode === m && styles.isActive)} onClick={() => setMode(m)}>
                  {m === "supply" ? "Supply" : "Withdraw"}
                </button>
              ))}
            </div>

            <div className={styles.amountBox}>
              <span className={cx(styles.amountValue, styles.figures)}>{token.amount}</span>
              <span className={styles.amountToken}>
                <img className={styles.tokenLogo} src={token.logo} alt="" />
                {token.symbol}
              </span>
            </div>
            <p className={styles.walletNote}>
              Wallet balance {token.walletBalance} · <button className={styles.maxLink}>Max</button>
            </p>

            <div className={styles.kvRow}>
              <span className={styles.muted}>Supply APY</span>
              <span className={styles.figures}>{token.supplyApy}</span>
            </div>
            <div className={styles.kvRow}>
              <span className={styles.muted}>Health factor after</span>
              <span className={cx(styles.figures, styles.kvPositive)}>
                {HEALTH_FACTOR.toFixed(2)} <span className={styles.kvArrow}>→</span> {token.healthAfter}
              </span>
            </div>

            <button className={styles.ctaButton}>
              {mode === "supply" ? "Supply" : "Withdraw"} {token.symbol}
            </button>
          </div>

          <div className={cx(styles.panel, styles.agentPanel)}>
            <div className={styles.agentPanelHead}>
              <span className={styles.agentMark} aria-hidden="true">✳</span>
              <p className={styles.panelTitle}>Rather not watch it?</p>
            </div>
            <p className={styles.panelSub}>
              The agent rotates between lending, yield and T-bills as rates move, inside limits you sign once.
            </p>
            <button className={styles.agentLink}>
              Move to agent <span className={styles.kvArrow}>→</span>
            </button>
          </div>
        </div>
      </div>

      <div className={styles.panel}>
        <p className={styles.panelTitle}>Your supplied positions</p>
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span className={styles.colAsset} style={{ flex: 1.3 }}>Asset</span>
            <span className={styles.colNum}>Supplied</span>
            <span className={styles.colNum}>APY</span>
            <span className={styles.colNum}>Managed by</span>
          </div>
          {POSITIONS.map((p, i) => (
            <div className={styles.tableRow} key={i}>
              <span className={styles.colAsset} style={{ flex: 1.3 }}>
                <img className={styles.tokenLogo} src={TOKEN_LOGOS[p.symbol]} alt="" />
                {p.symbol}
              </span>
              <span className={cx(styles.colNum, styles.figures, styles.muted)}>{p.supplied}</span>
              <span className={cx(styles.colNum, styles.figures, styles.muted)}>{p.apy}</span>
              <span className={styles.colNum}>
                <span className={cx(styles.badge, p.managedBy === "agent" && styles.isAgent)}>
                  {p.managedBy === "agent" ? "Agent" : "You"}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
