"use client";

import { useState } from "react";
import { cx } from "../../../lib/cx";
import { TOKEN_LOGOS } from "../../../lib/logos";
import { IconLayers, IconCursor, IconRoute, IconCheckCircle } from "../../../components/icons";
import styles from "../envelope.module.css";

const RANGES = {
  "7d": { delta: "+$1,240 · +1.3% this week" },
  "30d": { delta: "+$5,180 · +5.7% since you started" },
  All: { delta: "+$12,900 · +15.4% all time" },
};

const CHART_POINTS = "0,68 36,63.8 73,58.5 109,61.6 145,49.6 182,44.2 218,47.5 255,35.5 291,28.9 327,23.3 364,25.5 400,11.3";

const ASSETS = [
  { symbol: "USDC", logo: TOKEN_LOGOS.USDC, balance: "64,200", free: "13,700", value: "$64,200" },
  { symbol: "USTB", logo: null, balance: "13,062", free: null, value: "$13,600" },
  { symbol: "cirBTC", logo: TOKEN_LOGOS.cirBTC, balance: "0.1140", free: null, value: "$12,400" },
  { symbol: "EURC", logo: TOKEN_LOGOS.EURC, balance: "5,354", free: null, value: "$6,200" },
];

const POSITIONS = [
  { name: "USDC lending", logo: TOKEN_LOGOS.USDC, value: "$24,100", yield: "6.20%", access: "Anytime", by: "agent" },
  { name: "USDC lending", logo: TOKEN_LOGOS.USDC, value: "$18,000", yield: "6.20%", access: "Anytime", by: "you" },
  { name: "cirBTC supplied", logo: TOKEN_LOGOS.cirBTC, value: "$12,400", yield: "2.76%", access: "Anytime", by: "you" },
  { name: "Idle USDC", logo: TOKEN_LOGOS.USDC, value: "$13,700", yield: null, access: "Instant", by: "both" },
  { name: "Stable Yield vault", logo: TOKEN_LOGOS.USDC, value: "$8,400", yield: "8.40%", access: "15 Sep", accessWarn: true, by: "you" },
  { name: "Euro Yield vault", logo: TOKEN_LOGOS.EURC, value: "$6,200", yield: "6.30%", access: "11 Sep", accessWarn: true, by: "agent" },
  { name: "US T-Bill Note", logo: null, value: "$13,600", yield: "4.80%", access: "14 Sep", accessWarn: true, by: "both" },
];

const LADDER = [
  { width: 14, opacity: 1 },
  { width: 57, opacity: 0.7 },
  { width: 15, opacity: 0.45 },
  { width: 14, opacity: 0.25 },
];
const REACH = [
  { label: "Right now", value: "$13,700" },
  { label: "Anytime, pool permitting", value: "$54,500" },
  { label: "Within 6 days", value: "$14,600" },
  { label: "Within 14 days", value: "$13,600" },
];

const ACTIVITY = [
  { time: "11:32", text: "Held off rotating into Euro Yield", logo: TOKEN_LOGOS.EURC, by: "agent" },
  { time: "10:04", text: "Supplied 5,000 USDC", logo: TOKEN_LOGOS.USDC, by: "you" },
  { time: "09:05", text: "Rotated $4,200 into T-bills", logo: TOKEN_LOGOS.USDC, by: "agent" },
  { time: "02:14", text: "Deleveraged to health factor 2.30", logo: TOKEN_LOGOS.USDC, by: "agent" },
];

function ByTag({ by }) {
  if (by === "both") return <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Both</span>;
  return <span className={cx(styles.badge, by === "agent" && styles.isAgent)}>{by === "agent" ? "Agent" : "You"}</span>;
}

export default function PortfolioPage() {
  const [range, setRange] = useState("30d");

  return (
    <div className={styles.page}>
      <div className={cx(styles.panel, styles.elevated)}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
          <div>
            <p className={styles.statLabel}>Total portfolio</p>
            <p style={{ fontSize: 22, fontWeight: 500, margin: "0 0 2px" }}>$96,400</p>
            <p style={{ fontSize: 12, color: "var(--text-success)", margin: 0 }}>{RANGES[range].delta}</p>
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            {Object.keys(RANGES).map((r) => (
              <button
                key={r}
                className={cx(styles.badge, range === r && styles.isAgent)}
                style={{ cursor: "pointer", background: range === r ? undefined : "none", font: "inherit" }}
                onClick={() => setRange(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <svg width="100%" height="78" viewBox="0 0 400 78" preserveAspectRatio="none" role="img" aria-label="Portfolio value trending up">
          <polyline points={CHART_POINTS} fill="none" stroke="var(--fill-accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 14, marginTop: 6, borderTop: "1px solid var(--border)" }}>
          <span className={styles.panelTitle} style={{ margin: 0 }}>Your assets</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Free is what you can spend right now</span>
        </div>

        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span className={styles.colAsset} style={{ flex: 1.4 }}>Token</span>
            <span className={styles.colNum} style={{ flex: 1.2 }}>Balance</span>
            <span className={styles.colNum} style={{ flex: 1.1 }}>Free</span>
            <span className={styles.colNum} style={{ flex: 1.1 }}>Value</span>
          </div>
          {ASSETS.map((a) => (
            <div className={styles.tableRow} key={a.symbol} style={{ padding: "8px 0" }}>
              <span className={styles.colAsset} style={{ flex: 1.4 }}>
                {a.logo ? (
                  <img className={styles.tokenLogo} src={a.logo} alt="" />
                ) : (
                  <span className={styles.rowIcon}>
                    <IconLayers size={16} />
                  </span>
                )}
                {a.symbol}
              </span>
              <span className={cx(styles.colNum, styles.figures)} style={{ flex: 1.2 }}>{a.balance}</span>
              <span className={cx(styles.colNum, styles.figures, styles.muted)} style={{ flex: 1.1 }}>{a.free ?? "—"}</span>
              <span className={cx(styles.colNum, styles.figures, styles.muted)} style={{ flex: 1.1 }}>{a.value}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 11, marginTop: 3, borderTop: "1px solid var(--border)" }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Prices from Arc oracle · 2 min ago</span>
          <button className={styles.linkButton} style={{ fontSize: 12 }}>Show wrapped positions</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
        <div className={styles.panel}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
              <IconCursor size={16} />
              Self-managed
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>You sign each action</span>
          </div>
          <p style={{ fontSize: 20, fontWeight: 500, margin: "0 0 3px" }}>$48,200</p>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 12px" }}>50% of portfolio · 4.90% blended yield</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className={styles.badge} style={{ cursor: "pointer", background: "none", font: "inherit" }}>Lend</button>
            <button className={styles.badge} style={{ cursor: "pointer", background: "none", font: "inherit" }}>Swap</button>
            <button className={cx(styles.badge, styles.isAgent)} style={{ cursor: "pointer", border: "none", font: "inherit" }}>Move to agent</button>
          </div>
        </div>

        <div className={styles.panel}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
              <IconRoute size={16} />
              Agent vault
            </span>
            <span style={{ fontSize: 11, color: "var(--text-success)", display: "flex", alignItems: "center", gap: 4 }}>
              <IconCheckCircle size={13} />
              Active · 4 min
            </span>
          </div>
          <p style={{ fontSize: 20, fontWeight: 500, margin: "0 0 3px" }}>$48,200</p>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 12px" }}>50% of portfolio · 5.12% net APY · 24 days of mandate left</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className={styles.badge} style={{ cursor: "pointer", background: "none", font: "inherit" }}>Agent</button>
            <button className={styles.badge} style={{ cursor: "pointer", background: "none", font: "inherit" }}>Withdraw</button>
          </div>
        </div>
      </div>

      <div className={styles.panel}>
        <p className={styles.panelTitle}>All positions</p>
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span className={styles.colAsset} style={{ flex: 2 }}>Position</span>
            <span className={styles.colNum}>Value</span>
            <span className={styles.colNum}>Yield</span>
            <span className={styles.colNum} style={{ flex: 1.2 }}>Access</span>
            <span className={styles.colNum} style={{ flex: 0.9 }}>By</span>
          </div>
          {POSITIONS.map((p, i) => (
            <div className={styles.tableRow} key={i} style={{ padding: "8px 0" }}>
              <span className={styles.colAsset} style={{ flex: 2 }}>
                {p.logo ? (
                  <img className={styles.tokenLogo} src={p.logo} alt="" />
                ) : (
                  <span className={styles.rowIcon}>
                    <IconLayers size={16} />
                  </span>
                )}
                {p.name}
              </span>
              <span className={cx(styles.colNum, styles.figures, styles.muted)}>{p.value}</span>
              <span className={cx(styles.colNum, styles.figures, styles.muted)}>{p.yield ?? "—"}</span>
              <span className={styles.colNum} style={{ flex: 1.2, color: p.accessWarn ? "var(--text-warning)" : "var(--text-secondary)" }}>
                {p.access}
              </span>
              <span className={styles.colNum} style={{ flex: 0.9 }}>
                <ByTag by={p.by} />
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
        <div className={styles.panel}>
          <p className={styles.panelTitle}>When you can reach it</p>
          <p className={styles.panelSub} style={{ marginBottom: 12 }}>Across both lanes, if you asked today.</p>
          <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 12 }}>
            {LADDER.map((seg, i) => (
              <div key={i} style={{ width: `${seg.width}%`, background: "var(--fill-accent)", opacity: seg.opacity }} />
            ))}
          </div>
          {REACH.map((r) => (
            <div key={r.label} className={styles.kvRow}>
              <span>{r.label}</span>
              <span className={styles.figures} style={{ color: "var(--text-secondary)" }}>{r.value}</span>
            </div>
          ))}
        </div>

        <div className={styles.panel}>
          <p className={styles.panelTitle}>Recent activity</p>
          {ACTIVITY.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 11, padding: "8px 0", borderTop: "1px solid var(--border)", fontSize: 13, alignItems: "center" }}>
              <span className={cx(styles.figures, styles.muted)} style={{ fontSize: 12, minWidth: 42, flexShrink: 0 }}>{a.time}</span>
              <img className={styles.tokenLogo} src={a.logo} alt="" />
              <span style={{ flex: 1 }}>{a.text}</span>
              <ByTag by={a.by} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
