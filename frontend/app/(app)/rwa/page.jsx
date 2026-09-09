"use client";

import { useState } from "react";
import { cx } from "../../../lib/cx";
import { TOKEN_LOGOS } from "../../../lib/logos";
import { IconShieldCheck, IconCalendarClock, IconLayers, IconPercent, IconCalendar, IconClock, IconBank, IconWallet } from "../../../components/icons";
import styles from "../envelope.module.css";

const INSTRUMENTS = [
  {
    name: "US T-Bill Note",
    issuer: "Arc Treasury Fund",
    yield: "4.80%",
    window: "Daily",
    warnWindow: false,
    nav: 1.0412,
    walletBalance: "4,100",
    amount: "10,000",
    cutoff: "Today 16:00 UTC",
    delivered: "11 Sep",
  },
  {
    name: "Euro Bill Fund",
    issuer: "Arc Treasury Fund",
    yield: "3.10%",
    window: "Weekly",
    warnWindow: false,
    nav: 1.0186,
    walletBalance: "2,400",
    amount: "5,000",
    cutoff: "Fri 16:00 UTC",
    delivered: "20 Sep",
  },
  {
    name: "Private Credit Note",
    issuer: "Meridian Capital",
    yield: "8.90%",
    window: "Monthly",
    warnWindow: true,
    nav: 1.1043,
    walletBalance: "1,800",
    amount: "3,000",
    cutoff: "30 Sep 16:00 UTC",
    delivered: "3 Oct",
  },
];

const HOLDINGS = [
  { name: "US T-Bill Note", value: "$8,400", managedBy: "you" },
  { name: "US T-Bill Note", value: "$19,300", managedBy: "agent" },
  { name: "Private Credit", value: "$6,300", managedBy: "agent" },
];

const CALENDAR = [
  { date: "14 Sep", label: "US T-Bill Note", value: "$27,700", isNext: true },
  { date: "30 Sep", label: "Private Credit", value: "$6,300" },
  { date: "14 Oct", label: "Private Credit", value: "Next window" },
];

const STAT_TILES = [
  { key: "inRwa", label: "In RWA", value: "$34,000", icon: <IconLayers /> },
  { key: "yield", label: "Weighted yield", value: "5.20%", icon: <IconPercent /> },
  { key: "window", label: "Next window", value: "14 Sep", icon: <IconCalendar />, accent: true },
  { key: "settlement", label: "Settlement", value: "T+2", icon: <IconClock /> },
];

export default function RwaPage() {
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState("subscribe");
  const instrument = INSTRUMENTS[index];

  const [amount, setAmount] = useState(instrument.amount);
  const handleSelect = (i) => {
    setIndex(i);
    setAmount(INSTRUMENTS[i].amount);
  };
  const handleAmountChange = (e) => {
    const v = e.target.value;
    if (v === "" || /^\d*\.?\d*$/.test(v)) setAmount(v);
  };

  const amountNum = parseFloat(amount.replace(/,/g, "")) || 0;
  const unitsAtNav = Math.round(amountNum / instrument.nav);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeadRow}>
        <div className={styles.pageHead}>
          <span className={styles.eyebrow}>Arc Testnet · Railflow Protocol</span>
          <h1>Real-world assets</h1>
          <p className={styles.lead}>
            Tokenised treasuries and credit. Priced at issuer NAV, redeemed only in scheduled windows.
          </p>
        </div>
        <span className={styles.statusPill}>
          <IconShieldCheck size={14} />
          KYC verified
        </span>
      </div>

      <div className={styles.statGrid}>
        {STAT_TILES.map((tile) => (
          <div className={styles.statTile} key={tile.key}>
            <div className={styles.statIcon} style={{ color: "var(--text-accent)" }}>
              {tile.icon}
            </div>
            <div className={styles.statBody}>
              <p className={styles.statLabel}>{tile.label}</p>
              <p className={styles.statValue} style={{ color: tile.accent ? "var(--text-accent)" : "var(--text-primary)" }}>
                {tile.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.twoColGrid}>
        <div className={styles.panel}>
          <div className={styles.panelTitleRow}>
            <span className={styles.panelTitleIcon}>
              <IconBank size={16} />
            </span>
            <p className={styles.panelTitle}>Instruments</p>
          </div>
          <p className={styles.panelSub}>Yield is net of issuer fees. Window is how often you can exit.</p>
          <div className={styles.table}>
            <div className={styles.tableHead}>
              <span className={styles.colAsset} style={{ flex: 2 }}>Instrument</span>
              <span className={styles.colNum}>Yield</span>
              <span className={styles.colNum} style={{ flex: 1.2 }}>Window</span>
              <span className={styles.colNum}>NAV</span>
            </div>
            {INSTRUMENTS.map((inst, i) => (
              <button
                key={inst.name}
                className={cx(styles.tableRow, i === index && styles.isSelected)}
                onClick={() => handleSelect(i)}
              >
                <span className={styles.colAsset} style={{ flex: 2, gap: 10 }}>
                  <span className={styles.rowIcon}>
                    <IconLayers />
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
                    <span>{inst.name}</span>
                    <span className={styles.muted} style={{ fontSize: 11 }}>{inst.issuer}</span>
                  </span>
                </span>
                <span className={cx(styles.colNum, styles.figures)}>{inst.yield}</span>
                <span className={styles.colNum} style={{ flex: 1.2 }}>
                  <span className={cx(styles.badge, inst.warnWindow ? styles.isWarning : styles.isNeutral)}>{inst.window}</span>
                </span>
                <span className={cx(styles.colNum, styles.figures, styles.muted)}>{inst.nav.toFixed(4)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.sideCol}>
          <div className={cx(styles.panel, styles.elevated)}>
            <div className={styles.segmented}>
              {["subscribe", "redeem"].map((m) => (
                <button key={m} className={cx(styles.segment, mode === m && styles.isActive)} onClick={() => setMode(m)}>
                  {m === "subscribe" ? "Subscribe" : "Redeem"}
                </button>
              ))}
            </div>
            <p className={styles.statLabel} style={{ marginBottom: 8 }}>{instrument.name}</p>

            <div className={styles.amountBox}>
              <input
                className={styles.amountInput}
                value={amount}
                onChange={handleAmountChange}
                inputMode="decimal"
                placeholder="0"
                aria-label={`Amount to ${mode}`}
              />
              <span className={styles.amountToken}>
                <img className={styles.tokenLogo} src={TOKEN_LOGOS.USDC} alt="" />
                USDC
              </span>
            </div>
            <p className={styles.walletNote}>
              Wallet balance {instrument.walletBalance} · <button className={styles.maxLink} onClick={() => setAmount(instrument.walletBalance)}>Max</button>
            </p>

            <div className={styles.kvRow}>
              <span className={styles.muted}>Units at NAV</span>
              <span className={styles.figures}>{unitsAtNav.toLocaleString("en-US")}</span>
            </div>
            <div className={styles.kvRow}>
              <span className={styles.muted}>Order cut-off</span>
              <span className={styles.figures}>{instrument.cutoff}</span>
            </div>
            <div className={styles.kvRow}>
              <span className={styles.muted}>Units delivered</span>
              <span className={styles.figures}>{instrument.delivered}</span>
            </div>

            <button className={styles.ctaButton}>Place order</button>
          </div>

          <div className={styles.noteBanner}>
            <span className={styles.noteIcon}>
              <IconCalendarClock />
            </span>
            <p className={styles.noteText}>
              Orders placed after cut-off are priced at the next NAV. Redemptions settle two business days after the
              window closes.
            </p>
          </div>

          <div className={cx(styles.panel, styles.agentPanel)}>
            <div className={styles.agentPanelHead}>
              <span className={styles.agentMark} aria-hidden="true">✳</span>
              <p className={styles.panelTitle}>The agent plans ahead</p>
            </div>
            <p className={styles.panelSub}>
              It files redemption requests days before you need the cash, so a monthly window never becomes a month
              of waiting.
            </p>
            <button className={styles.agentLink}>
              Move to agent <span className={styles.kvArrow}>→</span>
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
        <div className={styles.panel}>
          <div className={styles.panelTitleRow}>
            <span className={styles.panelTitleIcon}>
              <IconWallet size={16} />
            </span>
            <p className={styles.panelTitle}>Your holdings</p>
          </div>
          <div className={styles.table}>
            <div className={styles.tableHead}>
              <span className={styles.colAsset} style={{ flex: 1.8 }}>Instrument</span>
              <span className={styles.colNum}>Value</span>
              <span className={styles.colNum}>By</span>
            </div>
            {HOLDINGS.map((h, i) => (
              <div className={styles.tableRow} key={i}>
                <span className={styles.colAsset} style={{ flex: 1.8 }}>
                  <span className={styles.rowIcon}>
                    <IconLayers />
                  </span>
                  {h.name}
                </span>
                <span className={cx(styles.colNum, styles.figures, styles.muted)}>{h.value}</span>
                <span className={styles.colNum}>
                  <span className={cx(styles.badge, h.managedBy === "agent" && styles.isAgent)}>
                    {h.managedBy === "agent" ? "Agent" : "You"}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelTitleRow}>
            <span className={styles.panelTitleIcon}>
              <IconCalendar size={16} />
            </span>
            <p className={styles.panelTitle}>Redemption calendar</p>
          </div>
          {CALENDAR.map((c, i) => (
            <div className={styles.dateRow} key={i}>
              <span className={styles.date}>{c.date}</span>
              <span className={styles.label}>
                {c.label}
                {c.isNext && (
                  <span className={cx(styles.badge, styles.isAgent)} style={{ marginLeft: 8 }}>
                    Next
                  </span>
                )}
              </span>
              <span className={styles.value}>{c.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
