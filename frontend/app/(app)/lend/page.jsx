"use client";

import { useEffect, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { cx } from "../../../lib/cx";
import { TOKEN_LOGOS } from "../../../lib/logos";
import { TOKENS } from "../../../lib/config";
import { useWallet } from "../../../lib/useWallet";
import { LENDING_ADDRESS } from "../../../lib/lendingContract";
import {
  useLendingPosition,
  useApproveCirBtc,
  useApproveUsdc,
  useDepositCollateral,
  useWithdrawCollateral,
  useTakeLoan,
  useRepayLoan,
} from "../../../lib/useLending";
import { IconLayers, IconShield, IconPercent, IconWallet } from "../../../components/icons";
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

const STAT_TILES = [
  { key: "collateral", label: "My collateral", value: "$44,100", icon: <IconLayers /> },
  { key: "health", label: "Health factor", value: HEALTH_FACTOR.toFixed(2), icon: <IconShield />, gauge: true },
  { key: "apy", label: "USDC supply APY", value: "6.20%", icon: <IconPercent /> },
  { key: "agent", label: "In agent vault", value: "$48,200", icon: <span aria-hidden="true">✳</span> },
];

// Illustrative preview — unchanged from before the contract existed. Shown
// whenever NEXT_PUBLIC_LENDING_ADDRESS isn't configured yet.
function IllustrativeLend() {
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
          <div className={styles.panelTitleRow}>
            <span className={styles.panelTitleIcon}>
              <IconLayers size={16} />
            </span>
            <p className={styles.panelTitle}>Supply markets</p>
          </div>
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
        <div className={styles.panelTitleRow}>
          <span className={styles.panelTitleIcon}>
            <IconWallet size={16} />
          </span>
          <p className={styles.panelTitle}>Your supplied positions</p>
        </div>
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

const CIRBTC_DECIMALS = TOKENS.cirBTC.decimals;
const USDC_DECIMALS = TOKENS.USDC.decimals;

function fmt(raw, decimals, fractionDigits = 4) {
  if (raw == null) return "0";
  const n = Number(formatUnits(raw, decimals));
  return n.toLocaleString("en-US", { maximumFractionDigits: fractionDigits });
}

const MODES = {
  deposit: { label: "Deposit", token: "cirBTC", decimals: CIRBTC_DECIMALS, needsApprove: true },
  withdraw: { label: "Withdraw", token: "cirBTC", decimals: CIRBTC_DECIMALS, needsApprove: false },
  borrow: { label: "Borrow", token: "USDC", decimals: USDC_DECIMALS, needsApprove: false },
  repay: { label: "Repay", token: "USDC", decimals: USDC_DECIMALS, needsApprove: true },
};

// Real on-chain Lend flow against the deployed LendingBorrowing contract:
// deposit cirBTC as collateral, borrow USDC against it, repay, withdraw.
function RealLend() {
  const { address, isConnected, correctNetwork } = useWallet();
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, loading, error } = useLendingPosition(address, refreshKey);

  const [mode, setMode] = useState("deposit");
  const [amount, setAmount] = useState("");
  const modeConfig = MODES[mode];

  const approveCirBtc = useApproveCirBtc();
  const approveUsdc = useApproveUsdc();
  const depositCollateral = useDepositCollateral();
  const withdrawCollateral = useWithdrawCollateral();
  const takeLoan = useTakeLoan();
  const repayLoan = useRepayLoan();

  const actionByMode = { deposit: depositCollateral, withdraw: withdrawCollateral, borrow: takeLoan, repay: repayLoan };
  const approveByMode = { deposit: approveCirBtc, repay: approveUsdc };
  const action = actionByMode[mode];
  const approve = approveByMode[mode];

  // Refetch position + allowance after any confirmed transaction, and clear
  // the amount field once the action (not just the approve) lands.
  useEffect(() => {
    if (approve?.isConfirmed || action.isConfirmed) {
      setRefreshKey((k) => k + 1);
    }
    if (action.isConfirmed) {
      setAmount("");
    }
  }, [approve?.isConfirmed, action.isConfirmed]);

  useEffect(() => {
    setAmount("");
    approveCirBtc.reset();
    approveUsdc.reset();
    depositCollateral.reset();
    withdrawCollateral.reset();
    takeLoan.reset();
    repayLoan.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleAmountChange = (e) => {
    const v = e.target.value;
    if (v === "" || /^\d*\.?\d*$/.test(v)) setAmount(v);
  };

  if (!isConnected || !correctNetwork || !data) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHead}>
          <span className={styles.eyebrow}>Arc Testnet · Railflow Protocol</span>
          <h1>Lend</h1>
          <p className={styles.lead}>
            Deposit cirBTC as collateral to borrow USDC against it — live on the LendingBorrowing contract.
          </p>
        </div>
        <div className={styles.noteBanner}>
          <p className={styles.noteText}>
            {!isConnected
              ? "Connect your wallet to see your real collateral and loan position."
              : !correctNetwork
                ? "Switch your wallet to Arc Testnet to use the real Lend contract."
                : loading
                  ? "Loading your position from the LendingBorrowing contract…"
                  : error
                    ? `Couldn't read the contract: ${error}`
                    : "Loading…"}
          </p>
        </div>
      </div>
    );
  }

  const collateralWhole = Number(formatUnits(data.collateral, CIRBTC_DECIMALS));
  const priceWhole = Number(formatUnits(data.collateralPrice, USDC_DECIMALS));
  const collateralValueUsd = collateralWhole * priceWhole;
  const borrowedWhole = Number(formatUnits(data.borrowed, USDC_DECIMALS));
  const maxBorrowWhole = Number(formatUnits(data.maxBorrow, USDC_DECIMALS));
  const utilizationPct = maxBorrowWhole > 0 ? Math.min(100, (borrowedWhole / maxBorrowWhole) * 100) : 0;
  const utilZone = utilizationPct < 60 ? "safe" : utilizationPct < 85 ? "caution" : "risk";

  const maxByMode = {
    deposit: data.cirBtcBalance,
    withdraw: data.collateral,
    borrow: data.availableToBorrow,
    repay: data.borrowed > data.usdcBalance ? data.usdcBalance : data.borrowed,
  };
  const amountRaw = (() => {
    try {
      return amount ? parseUnits(amount, modeConfig.decimals) : 0n;
    } catch {
      return 0n;
    }
  })();
  const allowanceByMode = { deposit: data.cirBtcAllowance, repay: data.usdcAllowance };
  const needsApprove = modeConfig.needsApprove && amountRaw > 0n && allowanceByMode[mode] < amountRaw;

  const busy = approve?.isPending || approve?.isConfirming || action.isPending || action.isConfirming;
  const spenderAmount = parseUnits("1000000000", modeConfig.decimals); // one-time approval, avoids re-approving every deposit/repay

  const primaryLabel = needsApprove
    ? approve.isPending
      ? "Confirm approval…"
      : approve.isConfirming
        ? "Approving…"
        : `Approve ${modeConfig.token}`
    : action.isPending
      ? "Confirm in wallet…"
      : action.isConfirming
        ? "Confirming…"
        : `${modeConfig.label} ${modeConfig.token}`;

  const handlePrimary = () => {
    if (amountRaw <= 0n) return;
    if (needsApprove) {
      approve.write([LENDING_ADDRESS, spenderAmount]);
    } else {
      action.write([amountRaw]);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <span className={styles.eyebrow}>Arc Testnet · Railflow Protocol</span>
        <h1>Lend</h1>
        <p className={styles.lead}>
          Deposit cirBTC as collateral to borrow USDC against it. Every action is a transaction you sign — nothing
          moves without your wallet.
        </p>
      </div>

      <div className={styles.statGrid}>
        <div className={styles.statTile}>
          <div className={styles.statIcon} style={{ color: "var(--text-accent)" }}>
            <img className={styles.tokenLogo} src={TOKEN_LOGOS.cirBTC} alt="" />
          </div>
          <div className={styles.statBody}>
            <p className={styles.statLabel}>My collateral</p>
            <p className={styles.statValue}>{fmt(data.collateral, CIRBTC_DECIMALS, 6)} cirBTC</p>
          </div>
        </div>
        <div className={styles.statTile}>
          <div className={styles.statIcon} style={{ color: "var(--text-accent)" }}>
            <img className={styles.tokenLogo} src={TOKEN_LOGOS.USDC} alt="" />
          </div>
          <div className={styles.statBody}>
            <p className={styles.statLabel}>Borrowed</p>
            <p className={styles.statValue}>${fmt(data.borrowed, USDC_DECIMALS, 2)}</p>
          </div>
        </div>
        <div className={styles.statTile}>
          <div className={styles.statIcon} style={{ color: "var(--text-accent)" }}>
            <IconShield />
          </div>
          <div className={styles.statBody}>
            <p className={styles.statLabel}>Borrow limit used</p>
            <p className={styles.statValue} style={{ color: "var(--text-success)" }}>{utilizationPct.toFixed(0)}%</p>
            <div className={styles.healthGauge} aria-hidden="true">
              <span className={cx(styles.healthGaugeFill, ZONE_CLASS[utilZone])} style={{ width: `${utilizationPct}%` }} />
            </div>
          </div>
        </div>
        <div className={styles.statTile}>
          <div className={styles.statIcon} style={{ color: "var(--text-accent)" }}>
            <IconPercent />
          </div>
          <div className={styles.statBody}>
            <p className={styles.statLabel}>Pool liquidity</p>
            <p className={styles.statValue}>${fmt(data.poolLiquidity, USDC_DECIMALS, 0)}</p>
          </div>
        </div>
      </div>

      <div className={styles.twoColGrid}>
        <div className={styles.panel}>
          <div className={styles.panelTitleRow}>
            <span className={styles.panelTitleIcon}>
              <IconLayers size={16} />
            </span>
            <p className={styles.panelTitle}>Market</p>
          </div>
          <p className={styles.panelSub}>cirBTC / USDC — the only live pair on Arc Testnet right now.</p>
          <div className={styles.kvRow}>
            <span className={styles.muted}>Collateral factor</span>
            <span className={styles.figures}>{(Number(data.collateralFactorBps) / 100).toFixed(0)}%</span>
          </div>
          <div className={styles.kvRow}>
            <span className={styles.muted}>cirBTC price (owner-set)</span>
            <span className={styles.figures}>${priceWhole.toLocaleString("en-US")}</span>
          </div>
          <div className={styles.kvRow}>
            <span className={styles.muted}>My collateral value</span>
            <span className={styles.figures}>${collateralValueUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
          </div>
          <div className={styles.kvRow} style={{ marginBottom: 0 }}>
            <span className={styles.muted}>My max borrow</span>
            <span className={styles.figures}>${maxBorrowWhole.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12 }}>
            No price oracle on testnet — cirBTC/USDC is set by the contract owner, not a live feed.
          </p>
        </div>

        <div className={styles.sideCol}>
          <div className={cx(styles.panel, styles.elevated)}>
            <div className={styles.segmented}>
              {Object.keys(MODES).map((m) => (
                <button key={m} className={cx(styles.segment, mode === m && styles.isActive)} onClick={() => setMode(m)}>
                  {MODES[m].label}
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
                aria-label={`Amount of ${modeConfig.token} to ${mode}`}
              />
              <span className={styles.amountToken}>
                <img className={styles.tokenLogo} src={TOKEN_LOGOS[modeConfig.token]} alt="" />
                {modeConfig.token}
              </span>
            </div>
            <p className={styles.walletNote}>
              {mode === "deposit" && `Wallet balance ${fmt(data.cirBtcBalance, CIRBTC_DECIMALS, 6)}`}
              {mode === "withdraw" && `Deposited ${fmt(data.collateral, CIRBTC_DECIMALS, 6)}`}
              {mode === "borrow" && `Available to borrow $${fmt(data.availableToBorrow, USDC_DECIMALS, 2)}`}
              {mode === "repay" && `Outstanding loan $${fmt(data.borrowed, USDC_DECIMALS, 2)}`} ·{" "}
              <button
                className={styles.maxLink}
                onClick={() => setAmount(formatUnits(maxByMode[mode], modeConfig.decimals))}
              >
                Max
              </button>
            </p>

            <button className={styles.ctaButton} onClick={handlePrimary} disabled={busy || amountRaw <= 0n}>
              {primaryLabel}
            </button>

            {(approve?.error || action.error) && (
              <p style={{ fontSize: 11, color: "var(--text-danger)", marginTop: 8 }}>
                {(approve?.error || action.error).shortMessage || "Transaction failed."}
              </p>
            )}
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
    </div>
  );
}

export default function LendPage() {
  if (!LENDING_ADDRESS) return <IllustrativeLend />;
  return <RealLend />;
}
