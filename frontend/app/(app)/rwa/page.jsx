"use client";

import { useEffect, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useSwitchChain } from "wagmi";
import { cx } from "../../../lib/cx";
import { TOKEN_LOGOS } from "../../../lib/logos";
import { TOKENS, ENV, explorerTxUrl } from "../../../lib/config";
import { useWallet } from "../../../lib/useWallet";
import { useApproveToken } from "../../../lib/useLendingPool";
import { TBILL_ADDRESS } from "../../../lib/tbillContract";
import { useTBillPosition, useSubscribeTBill, useRedeemTBill } from "../../../lib/useTBill";
import { IconShieldCheck, IconLayers, IconPercent, IconClock, IconBank, IconWallet } from "../../../components/icons";
import styles from "../envelope.module.css";

const RAY = 10n ** 18n;
const USDC_DECIMALS = 6;

function fmtUsdc(raw, fractionDigits = 2) {
  if (raw == null) return "—";
  return Number(formatUnits(raw, USDC_DECIMALS)).toLocaleString("en-US", { maximumFractionDigits: fractionDigits });
}
function unitsToUsdc(units, nav) {
  if (units == null || nav == null) return 0n;
  return (units * nav) / RAY;
}

export default function RwaPage() {
  const { address, isConnected, correctNetwork } = useWallet();
  const { switchChain, isPending: switchingChain } = useSwitchChain();
  const [refreshKey, setRefreshKey] = useState(0);
  const [mode, setMode] = useState("subscribe");
  const [amount, setAmount] = useState("");

  const { data, loading } = useTBillPosition(address, refreshKey);
  const approve = useApproveToken(TOKENS.USDC.address);
  const subscribeTBill = useSubscribeTBill();
  const redeemTBill = useRedeemTBill();

  useEffect(() => {
    if (approve.isConfirmed || subscribeTBill.isConfirmed || redeemTBill.isConfirmed) {
      setRefreshKey((k) => k + 1);
    }
    if (subscribeTBill.isConfirmed || redeemTBill.isConfirmed) {
      setAmount("");
      approve.reset();
      subscribeTBill.reset();
      redeemTBill.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approve.isConfirmed, subscribeTBill.isConfirmed, redeemTBill.isConfirmed]);

  const handleAmountChange = (e) => {
    const v = e.target.value;
    if (v === "" || /^\d*\.?\d*$/.test(v)) setAmount(v);
  };
  const handleModeChange = (m) => {
    setMode(m);
    setAmount("");
  };

  if (!isConnected || !correctNetwork || !data) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHead}>
          <span className={styles.eyebrow}>Arc Testnet · Railflow Protocol</span>
          <h1>Real-world assets</h1>
          <p className={styles.lead}>
            A real NAV-appreciating tokenized bill — subscribe and redeem USDC at the live on-chain NAV.
          </p>
        </div>
        <div className={styles.noteBanner}>
          <p className={styles.noteText}>
            {!isConnected
              ? "Connect your wallet to see your real RWA position."
              : !correctNetwork
                ? "RWA runs on Arc Testnet — the network your wallet is on doesn't have this contract."
                : loading
                  ? "Loading…"
                  : "Loading…"}
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

  const myValueUsdc = unitsToUsdc(data.units, data.nav);
  const apyPct = (Number(data.apyBps) / 100).toFixed(2);
  const navFormatted = Number(formatUnits(data.nav, 18)).toFixed(6);

  const amountRaw = (() => {
    try {
      return amount ? parseUnits(amount, USDC_DECIMALS) : 0n;
    } catch {
      return 0n;
    }
  })();

  const isSubscribe = mode === "subscribe";
  const needsApprove = isSubscribe && amountRaw > 0n && data.allowance < amountRaw;
  const unitsForAmount = isSubscribe ? (amountRaw * RAY) / data.nav : amountRaw;
  const maxRedeemUsdc = unitsToUsdc(data.units, data.nav);

  const insufficientBalance = isSubscribe ? amountRaw > data.balance : amountRaw > maxRedeemUsdc;
  const insufficientReserve = !isSubscribe && amountRaw > 0n && unitsToUsdc(unitsForAmount, data.nav) > data.reserve;
  const canSubmit = amountRaw > 0n && !insufficientBalance && !insufficientReserve;
  const busy = approve.isPending || approve.isConfirming || subscribeTBill.isPending || subscribeTBill.isConfirming || redeemTBill.isPending || redeemTBill.isConfirming;

  const primaryLabel = needsApprove
    ? approve.isPending
      ? "Confirm approval…"
      : approve.isConfirming
        ? "Approving…"
        : "Approve USDC"
    : isSubscribe
      ? subscribeTBill.isPending
        ? "Confirm in wallet…"
        : subscribeTBill.isConfirming
          ? "Subscribing…"
          : "Subscribe"
      : redeemTBill.isPending
        ? "Confirm in wallet…"
        : redeemTBill.isConfirming
          ? "Redeeming…"
          : "Redeem";

  const handlePrimary = () => {
    if (!canSubmit) return;
    if (needsApprove) {
      approve.write([TBILL_ADDRESS, parseUnits("1000000000", USDC_DECIMALS)]);
    } else if (isSubscribe) {
      subscribeTBill.write([amountRaw]);
    } else {
      redeemTBill.write([unitsForAmount]);
    }
  };

  const STAT_TILES = [
    { key: "inRwa", label: "My position", value: `$${fmtUsdc(myValueUsdc, 2)}`, icon: <IconLayers /> },
    { key: "yield", label: "Current APY", value: `${apyPct}%`, icon: <IconPercent /> },
    { key: "nav", label: "Live NAV", value: navFormatted, icon: <IconClock />, accent: true },
    { key: "reserve", label: "Redemption reserve", value: `$${fmtUsdc(data.reserve, 2)}`, icon: <IconBank /> },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.pageHeadRow}>
        <div className={styles.pageHead}>
          <span className={styles.eyebrow}>Arc Testnet · Railflow Protocol</span>
          <h1>Real-world assets</h1>
          <p className={styles.lead}>
            RailFlow T-Bill: a real, NAV-appreciating instrument. Subscribe and redeem USDC at the live on-chain
            NAV — no scheduled windows here, unlike a real fund's cut-offs.
          </p>
        </div>
        <span className={styles.statusPill}>
          <IconShieldCheck size={14} />
          Testnet demo
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
            <p className={styles.panelTitle}>RailFlow T-Bill</p>
          </div>
          <p className={styles.panelSub}>
            NAV starts at 1.000000 and grows continuously at the APY above — every subscribe/redeem happens at
            whatever NAV is live at that exact block.
          </p>
          <div className={styles.kvRow}>
            <span className={styles.muted}>Asset</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <img className={styles.tokenLogo} src={TOKEN_LOGOS.USDC} alt="" />
              USDC
            </span>
          </div>
          <div className={styles.kvRow}>
            <span className={styles.muted}>My units</span>
            <span className={styles.figures}>{Number(formatUnits(data.units, 18)).toLocaleString("en-US", { maximumFractionDigits: 6 })}</span>
          </div>
          <div className={styles.kvRow}>
            <span className={styles.muted}>Total units outstanding</span>
            <span className={cx(styles.figures, styles.muted)}>{Number(formatUnits(data.totalUnits, 18)).toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
          </div>
          <div className={styles.kvRow} style={{ marginBottom: 0 }}>
            <span className={styles.muted}>Redemption reserve</span>
            <span className={cx(styles.figures, styles.muted)}>{fmtUsdc(data.reserve, 2)} USDC</span>
          </div>
        </div>

        <div className={styles.sideCol}>
          <div className={cx(styles.panel, styles.elevated)}>
            <div className={styles.segmented}>
              {["subscribe", "redeem"].map((m) => (
                <button key={m} className={cx(styles.segment, mode === m && styles.isActive)} onClick={() => handleModeChange(m)}>
                  {m === "subscribe" ? "Subscribe" : "Redeem"}
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
                aria-label={`Amount to ${mode}`}
              />
              <span className={styles.amountToken}>
                <img className={styles.tokenLogo} src={TOKEN_LOGOS.USDC} alt="" />
                USDC
              </span>
            </div>
            <p className={styles.walletNote}>
              {isSubscribe ? `Wallet balance ${fmtUsdc(data.balance, 6)}` : `Redeemable ${fmtUsdc(maxRedeemUsdc, 6)}`} ·{" "}
              <button
                className={styles.maxLink}
                onClick={() => setAmount(formatUnits(isSubscribe ? data.balance : maxRedeemUsdc, USDC_DECIMALS))}
              >
                Max
              </button>
            </p>

            <div className={styles.kvRow}>
              <span className={styles.muted}>Live NAV</span>
              <span className={styles.figures}>{navFormatted}</span>
            </div>
            <div className={styles.kvRow} style={{ marginBottom: 16 }}>
              <span className={styles.muted}>{isSubscribe ? "Units received" : "Units burned"}</span>
              <span className={styles.figures}>{Number(formatUnits(unitsForAmount, 18)).toLocaleString("en-US", { maximumFractionDigits: 6 })}</span>
            </div>
            {insufficientReserve && (
              <p style={{ fontSize: 11, color: "var(--text-warning)", marginTop: -8, marginBottom: 12 }}>
                The reserve can't cover a redemption this size yet — try a smaller amount.
              </p>
            )}

            <button className={styles.ctaButton} onClick={handlePrimary} disabled={!canSubmit || busy}>
              {primaryLabel}
            </button>
            {(approve.error || subscribeTBill.error || redeemTBill.error) && (
              <p style={{ fontSize: 11, color: "var(--text-danger)", marginTop: 8 }}>
                {(approve.error || subscribeTBill.error || redeemTBill.error).shortMessage || "Transaction failed."}
              </p>
            )}
          </div>

          <div className={cx(styles.panel, styles.agentPanel)}>
            <div className={styles.agentPanelHead}>
              <span className={styles.agentMark} aria-hidden="true">✳</span>
              <p className={styles.panelTitle}>The agent plans ahead</p>
            </div>
            <p className={styles.panelSub}>
              Once RWA has real redemption windows, the agent will file requests days before you need the cash —
              this instrument is always-liquid for now, so there's nothing to plan around yet.
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
          <p className={styles.panelTitle}>Your position</p>
        </div>
        {data.units === 0n ? (
          <p className={styles.panelSub}>No position yet — subscribe above to start earning at the live NAV.</p>
        ) : (
          <div className={styles.table}>
            <div className={styles.tableHead}>
              <span className={styles.colAsset} style={{ flex: 1.8 }}>Instrument</span>
              <span className={styles.colNum}>Units</span>
              <span className={styles.colNum}>Value</span>
            </div>
            <div className={styles.tableRow}>
              <span className={styles.colAsset} style={{ flex: 1.8 }}>
                <span className={styles.rowIcon}>
                  <IconLayers />
                </span>
                RailFlow T-Bill
              </span>
              <span className={cx(styles.colNum, styles.figures)}>{Number(formatUnits(data.units, 18)).toLocaleString("en-US", { maximumFractionDigits: 4 })}</span>
              <span className={cx(styles.colNum, styles.figures)}>${fmtUsdc(myValueUsdc, 2)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
