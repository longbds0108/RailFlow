"use client";

import { useState } from "react";
import { cx } from "../../../lib/cx";
import { TOKEN_LOGOS } from "../../../lib/logos";
import { IconSwapHorizontal, IconTrendUp, IconClock, IconCheckCircle, IconLoader, IconCircleEmpty, IconRoute, IconHistory } from "../../../components/icons";
import styles from "../envelope.module.css";

const CHAINS = ["Arc", "Ethereum", "Base", "Avalanche"];

const STAT_TILES = [
  { key: "transit", label: "In transit", value: "$12,000", icon: <IconSwapHorizontal /> },
  { key: "longest", label: "Longest wait", value: "6", suffix: " min", icon: <IconClock /> },
  { key: "typical", label: "Typical time", value: "14", suffix: " min", icon: <IconClock /> },
  { key: "sent", label: "Sent this month", value: "$84,200", icon: <IconTrendUp /> },
];

const TRACKER_STEPS = [
  { title: "Burned on Arc", caption: "6 min ago · 0x4b1e…", status: "done" },
  { title: "Waiting for attestation", caption: "Usually 8 to 12 minutes", status: "active" },
  { title: "Mint on Ethereum", caption: "Estimated 09:41 UTC", status: "pending" },
];

const RECENT_TRANSFERS = [
  { route: "Arc → Ethereum", amount: "$12,000", took: "6 min", status: "In flight", by: "You", warn: false },
  { route: "Base → Arc", amount: "$40,000", took: "13 min", status: "Complete", by: "Agent", warn: false },
  { route: "Arc → Avalanche", amount: "$9,200", took: "47 min", status: "Delayed", by: "You", warn: true },
];

const STATUS_BADGE = { "In flight": styles.isAgent, Complete: styles.isSuccess, Delayed: styles.isWarning };

export default function BridgePage() {
  const [fromChain, setFromChain] = useState("Arc");
  const [toChain, setToChain] = useState("Base");
  const [amount, setAmount] = useState("25000");

  const handleAmountChange = (e) => {
    const v = e.target.value;
    if (v === "" || /^\d*\.?\d*$/.test(v)) setAmount(v);
  };
  const handleFromChange = (chain) => {
    if (chain === toChain) setToChain(fromChain);
    setFromChain(chain);
  };
  const handleToChange = (chain) => {
    if (chain === fromChain) setFromChain(toChain);
    setToChain(chain);
  };
  const flip = () => {
    setFromChain(toChain);
    setToChain(fromChain);
  };

  const receiveAmount = amount ? Number(amount).toLocaleString("en-US") : "0";

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <span className={styles.eyebrow}>Arc Testnet · Railflow Protocol</span>
        <h1>Bridge</h1>
        <p className={styles.lead}>
          Native USDC across chains. While a transfer is in flight it belongs to neither side, so we show you
          exactly where it is.
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
              <p className={styles.statValue}>
                {tile.value}
                {tile.suffix && <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 400 }}>{tile.suffix}</span>}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.twoColGrid}>
        <div className={cx(styles.panel, styles.elevated)}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <p className={styles.statLabel} style={{ marginBottom: 5 }}>From</p>
              <div className={styles.fieldBox}>
                <select className={styles.fieldSelect} value={fromChain} onChange={(e) => handleFromChange(e.target.value)} aria-label="From chain">
                  {CHAINS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <button className={styles.iconButton} onClick={flip} aria-label="Flip bridge direction" style={{ marginBottom: 2 }}>
              <IconSwapHorizontal />
            </button>
            <div style={{ flex: 1 }}>
              <p className={styles.statLabel} style={{ marginBottom: 5 }}>To</p>
              <div className={styles.fieldBox}>
                <select className={styles.fieldSelect} value={toChain} onChange={(e) => handleToChange(e.target.value)} aria-label="To chain">
                  {CHAINS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <p className={styles.statLabel} style={{ marginBottom: 6 }}>Amount</p>
          <div className={styles.amountBox}>
            <input
              className={styles.amountInput}
              value={amount}
              onChange={handleAmountChange}
              inputMode="decimal"
              placeholder="0"
              aria-label="Amount to bridge"
            />
            <span className={styles.amountToken}>
              <img className={styles.tokenLogo} src={TOKEN_LOGOS.USDC} alt="" />
              USDC
            </span>
          </div>
          <p className={styles.walletNote}>
            Balance 30,000 · <button className={styles.maxLink} onClick={() => setAmount("30000")}>Max</button>
          </p>

          <div className={styles.kvRow}>
            <span className={styles.muted}>Route</span>
            <span>CCTP · native burn and mint</span>
          </div>
          <div className={styles.kvRow}>
            <span className={styles.muted}>You receive</span>
            <span className={styles.figures}>{receiveAmount} USDC</span>
          </div>
          <div className={styles.kvRow}>
            <span className={styles.muted}>Estimated arrival</span>
            <span className={styles.figures}>~14 min</span>
          </div>

          <button className={styles.ctaButton}>Bridge USDC</button>
        </div>

        <div className={styles.sideCol}>
          <div className={styles.panel}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span className={styles.panelTitleIcon}>
                  <IconRoute size={16} />
                </span>
                <span className={styles.panelTitle} style={{ margin: 0 }}>In flight now</span>
              </span>
              <span className={cx(styles.figures, styles.muted)} style={{ fontSize: 12 }}>$12,000 · Arc → Ethereum</span>
            </div>
            {TRACKER_STEPS.map((step, i) => (
              <div className={styles.timelineStep} key={i}>
                <span
                  className={styles.timelineIcon}
                  style={{
                    color:
                      step.status === "done" ? "var(--text-success)" : step.status === "active" ? "var(--text-accent)" : "var(--text-muted)",
                  }}
                >
                  {step.status === "done" && <IconCheckCircle />}
                  {step.status === "active" && (
                    <span className={styles.spin} style={{ display: "inline-flex" }}>
                      <IconLoader />
                    </span>
                  )}
                  {step.status === "pending" && <IconCircleEmpty />}
                </span>
                <div>
                  <p className={styles.timelineTitle} style={{ color: step.status === "pending" ? "var(--text-secondary)" : "var(--text-primary)" }}>
                    {step.title}
                  </p>
                  <p className={cx(styles.timelineCaption, step.status === "done" && styles.figures)}>{step.caption}</p>
                </div>
              </div>
            ))}
          </div>

          <div className={cx(styles.panel, styles.agentPanel)}>
            <div className={styles.agentPanelHead}>
              <span className={styles.agentMark} aria-hidden="true">✳</span>
              <p className={styles.panelTitle}>The agent tracks every transfer</p>
            </div>
            <p className={styles.panelSub}>
              In-flight capital still counts toward your balance, and anything overdue is flagged rather than
              quietly forgotten.
            </p>
            <button className={styles.agentLink}>
              Move to agent <span className={styles.kvArrow}>→</span>
            </button>
          </div>
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.panelTitleRow}>
          <span className={styles.panelTitleIcon}>
            <IconHistory size={16} />
          </span>
          <p className={styles.panelTitle}>Recent transfers</p>
        </div>
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span className={styles.colAsset} style={{ flex: 1.8 }}>Route</span>
            <span className={styles.colNum}>Amount</span>
            <span className={styles.colNum}>Took</span>
            <span className={styles.colNum}>Status</span>
            <span className={styles.colNum} style={{ flex: 0.8 }}>By</span>
          </div>
          {RECENT_TRANSFERS.map((t, i) => (
            <div className={styles.tableRow} key={i}>
              <span className={styles.colAsset} style={{ flex: 1.8 }}>{t.route}</span>
              <span className={cx(styles.colNum, styles.figures, styles.muted)}>{t.amount}</span>
              <span className={styles.colNum} style={{ color: t.warn ? "var(--text-warning)" : "var(--text-secondary)" }}>{t.took}</span>
              <span className={styles.colNum}>
                <span className={cx(styles.badge, STATUS_BADGE[t.status])}>{t.status}</span>
              </span>
              <span className={styles.colNum} style={{ flex: 0.8, fontSize: 11, color: "var(--text-secondary)" }}>{t.by}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
