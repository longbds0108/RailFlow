"use client";

import { useState } from "react";
import { cx } from "../../../lib/cx";
import { TOKEN_LOGOS } from "../../../lib/logos";
import { IconLayers, IconPercent, IconClock, IconLock, IconWallet } from "../../../components/icons";
import styles from "../envelope.module.css";

const VAULTS = [
  {
    name: "Stable Yield",
    asset: "USDC",
    logo: TOKEN_LOGOS.USDC,
    apy: "8.40%",
    lock: "14d",
    premium: "+220bp",
    walletBalance: "4,100",
    amount: "10,000",
    unlocksOn: "23 Sep 2026",
    lockedShareAfter: "29% / 40%",
  },
  {
    name: "Euro Yield",
    asset: "EURC",
    logo: TOKEN_LOGOS.EURC,
    apy: "6.30%",
    lock: "7d",
    premium: "+210bp",
    walletBalance: "2,400",
    amount: "5,000",
    unlocksOn: "16 Sep 2026",
    lockedShareAfter: "24% / 40%",
  },
  {
    name: "cirBTC staking",
    asset: "cirBTC",
    logo: TOKEN_LOGOS.cirBTC,
    apy: "4.60%",
    lock: "21d",
    premium: "+184bp",
    walletBalance: "0.42",
    amount: "0.1",
    unlocksOn: "30 Sep 2026",
    lockedShareAfter: "22% / 40%",
  },
];

const STAT_TILES = [
  { key: "inVaults", label: "In yield vaults", value: "$18,600", icon: <IconLayers /> },
  { key: "apy", label: "Weighted APY", value: "7.90%", icon: <IconPercent /> },
  { key: "unlock", label: "Next unlock", value: "6", suffix: " days", icon: <IconClock />, accent: true },
  { key: "locked", label: "Locked share", value: "19%", suffix: " / 40%", icon: <IconLock /> },
];

const POSITIONS = [
  { name: "Stable Yield", asset: "USDC", managedBy: "you", value: "$12,400", apy: "8.40%", pct: 57, unlocks: "15 Sep", daysLeft: 6 },
  { name: "Euro Yield", asset: "EURC", managedBy: "agent", value: "$6,200", apy: "6.30%", pct: 71, unlocks: "11 Sep", daysLeft: 2 },
];

export default function YieldPage() {
  const [index, setIndex] = useState(0);
  const vault = VAULTS[index];
  const [amount, setAmount] = useState(vault.amount);

  const handleSelect = (i) => {
    setIndex(i);
    setAmount(VAULTS[i].amount);
  };
  const handleAmountChange = (e) => {
    const v = e.target.value;
    if (v === "" || /^\d*\.?\d*$/.test(v)) setAmount(v);
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <span className={styles.eyebrow}>Arc Testnet · Railflow Protocol</span>
        <h1>Yield</h1>
        <p className={styles.lead}>
          Higher rates in exchange for a lock-up. Every vault shows what you are paid for giving up access, and
          exactly when you get it back.
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
              <p className={styles.statValue} style={{ color: tile.accent ? "var(--text-accent)" : "var(--text-primary)" }}>
                {tile.value}
                {tile.suffix && <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 400 }}>{tile.suffix}</span>}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.twoColGrid}>
        <div className={styles.panel}>
          <div className={styles.panelTitleRow}>
            <span className={styles.panelTitleIcon}>
              <IconLock size={16} />
            </span>
            <p className={styles.panelTitle}>Vaults</p>
          </div>
          <p className={styles.panelSub}>Premium is the extra yield over lending the same asset with no lock.</p>
          <div className={styles.table}>
            <div className={styles.tableHead}>
              <span className={styles.colAsset} style={{ flex: 1.8 }}>Vault</span>
              <span className={styles.colNum}>APY</span>
              <span className={styles.colNum}>Lock</span>
              <span className={styles.colNum} style={{ flex: 1.1 }}>Premium</span>
            </div>
            {VAULTS.map((v, i) => (
              <button
                key={v.name}
                className={cx(styles.tableRow, i === index && styles.isSelected)}
                onClick={() => handleSelect(i)}
              >
                <span className={styles.colAsset} style={{ flex: 1.8 }}>
                  <img className={styles.tokenLogo} src={v.logo} alt="" />
                  {v.name} · {v.asset}
                </span>
                <span className={cx(styles.colNum, styles.figures)}>{v.apy}</span>
                <span className={cx(styles.colNum, styles.muted)}>{v.lock}</span>
                <span className={cx(styles.colNum, styles.figures, styles.kvPositive)} style={{ flex: 1.1 }}>
                  {v.premium}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.sideCol}>
          <div className={cx(styles.panel, styles.elevated)}>
            <div className={styles.tokenTabs}>
              {VAULTS.map((v, i) => (
                <button
                  key={v.name}
                  className={cx(styles.tokenChip, i === index && styles.isActive)}
                  onClick={() => handleSelect(i)}
                >
                  <img className={styles.tokenChipLogo} src={v.logo} alt="" />
                  {v.name}
                </button>
              ))}
            </div>

            <div className={styles.amountBox}>
              <input
                className={styles.amountInput}
                value={amount}
                onChange={handleAmountChange}
                inputMode="decimal"
                placeholder="0"
                aria-label={`Amount to deposit in ${vault.name}`}
              />
              <span className={styles.amountToken}>
              <img className={styles.tokenLogo} src={vault.logo} alt="" />
              {vault.asset}
            </span>
            </div>
            <p className={styles.walletNote}>
              Wallet balance {vault.walletBalance} · <button className={styles.maxLink} onClick={() => setAmount(vault.walletBalance.replace(/,/g, ""))}>Max</button>
            </p>

            <div className={styles.kvRow}>
              <span className={styles.muted}>APY</span>
              <span className={styles.figures}>{vault.apy}</span>
            </div>
            <div className={styles.kvRow}>
              <span className={styles.muted}>Unlocks on</span>
              <span className={styles.figures}>{vault.unlocksOn}</span>
            </div>
            <div className={styles.kvRow}>
              <span className={styles.muted}>Locked share after</span>
              <span className={styles.figures}>{vault.lockedShareAfter}</span>
            </div>

            <button className={styles.ctaButton}>Deposit and lock</button>
          </div>

          <div className={styles.warningBanner}>
            <span className={styles.warningIcon}>
              <IconLock />
            </span>
            <p className={styles.warningText}>
              There is no early exit. Do not deposit funds you may need before {vault.unlocksOn.split(" ").slice(0, 2).join(" ")}.
            </p>
          </div>

          <div className={cx(styles.panel, styles.agentPanel)}>
            <div className={styles.agentPanelHead}>
              <span className={styles.agentMark} aria-hidden="true">✳</span>
              <p className={styles.panelTitle}>The agent won&rsquo;t over-lock you</p>
            </div>
            <p className={styles.panelSub}>
              It matches lock-ups to your withdrawal queue and never locks past the life of your mandate. Choosing
              lock periods by hand is where most people get trapped.
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
            <IconWallet size={16} />
          </span>
          <p className={styles.panelTitle}>Your positions</p>
        </div>
        {POSITIONS.map((p, i) => (
          <div className={styles.positionCard} key={i}>
            <div className={styles.positionHead}>
              <span style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 7 }}>
                <img className={styles.tokenLogo} src={TOKEN_LOGOS[p.asset]} alt="" style={{ width: 16, height: 16 }} />
                {p.name} · {p.asset}{" "}
                <span className={cx(styles.badge, p.managedBy === "agent" && styles.isAgent)} style={{ marginLeft: 6 }}>
                  {p.managedBy === "agent" ? "Agent" : "You"}
                </span>
              </span>
              <span className={cx(styles.figures, styles.muted)} style={{ fontSize: 13 }}>
                {p.value} · {p.apy}
              </span>
            </div>
            <div className={styles.meter}>
              <span className={styles.meterFill} style={{ width: `${p.pct}%` }} />
            </div>
            <p className={styles.positionCaption}>
              Unlocks {p.unlocks} · {p.daysLeft} days left
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
