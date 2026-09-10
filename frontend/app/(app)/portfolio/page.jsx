"use client";

import { useState } from "react";
import { formatUnits } from "viem";
import { useSwitchChain } from "wagmi";
import { cx } from "../../../lib/cx";
import { TOKEN_LOGOS } from "../../../lib/logos";
import { ENV, explorerTxUrl } from "../../../lib/config";
import { useWallet } from "../../../lib/useWallet";
import { useLendingPoolPosition, useMandateStatus, useAgentDecisionLog } from "../../../lib/useLendingPool";
import { YIELD_VAULTS } from "../../../lib/yieldVaultContract";
import { useYieldPositions } from "../../../lib/useYieldVault";
import { useTBillPosition } from "../../../lib/useTBill";
import { useSwapHistory } from "../../../lib/useSwapAmm";
import { IconLayers, IconShield } from "../../../components/icons";
import styles from "../envelope.module.css";

const SYMBOLS = ["USDC", "EURC", "cirBTC"];
const RAY = 10n ** 18n;

function usd(value) {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export default function PortfolioPage() {
  const { address, isConnected, correctNetwork } = useWallet();
  const { switchChain, isPending: switchingChain } = useSwitchChain();
  const [refreshKey] = useState(0);

  const { data: lend } = useLendingPoolPosition(address, refreshKey);
  const { data: yieldVaults } = useYieldPositions(address, refreshKey);
  const { data: tbill } = useTBillPosition(address, refreshKey);
  const { data: mandate } = useMandateStatus(address, refreshKey);
  const { entries: agentDecisions } = useAgentDecisionLog(address, refreshKey);
  const { entries: swaps } = useSwapHistory(address, refreshKey);

  if (!isConnected || !correctNetwork || !lend || !yieldVaults || !tbill) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHead}>
          <span className={styles.eyebrow}>Arc Testnet · Railflow Protocol</span>
          <h1>Portfolio</h1>
          <p className={styles.lead}>Your real position across Lend, Yield and RWA, aggregated from the chain.</p>
        </div>
        <div className={styles.noteBanner}>
          <p className={styles.noteText}>
            {!isConnected
              ? "Connect your wallet to see your real portfolio."
              : !correctNetwork
                ? "Portfolio aggregates contracts on Arc Testnet — switch networks to load it."
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

  const priceUsd = (symbol) => Number(formatUnits(lend.assets[symbol].priceInUsdc, 6));
  const toUsd = (raw, decimals, symbol) => Number(formatUnits(raw, decimals)) * priceUsd(symbol);

  const walletRows = SYMBOLS.map((symbol) => {
    const a = lend.assets[symbol];
    return { symbol, balance: a.balance, decimals: a.decimals, valueUsd: toUsd(a.balance, a.decimals, symbol) };
  });
  const walletValueUsd = walletRows.reduce((s, r) => s + r.valueUsd, 0);

  const lendSuppliedUsd = SYMBOLS.reduce((s, symbol) => s + toUsd(lend.assets[symbol].supplied, lend.assets[symbol].decimals, symbol), 0);
  const lendBorrowedUsd = SYMBOLS.reduce((s, symbol) => s + toUsd(lend.assets[symbol].borrowed, lend.assets[symbol].decimals, symbol), 0);

  const yieldRows = YIELD_VAULTS.map(({ vaultId, name, symbol }) => {
    const v = yieldVaults[vaultId];
    const totalRaw = v.principal + v.pendingInterest;
    return { vaultId, name, symbol, principal: v.principal, pendingInterest: v.pendingInterest, unlocksAt: v.unlocksAt, valueUsd: toUsd(totalRaw, lend.assets[symbol].decimals, symbol) };
  }).filter((r) => r.principal > 0n);
  const yieldValueUsd = yieldRows.reduce((s, r) => s + r.valueUsd, 0);
  const yieldLockedUsd = yieldRows
    .filter((r) => BigInt(Math.floor(Date.now() / 1000)) < r.unlocksAt)
    .reduce((s, r) => s + r.valueUsd, 0);

  const rwaUnits = tbill.units;
  const rwaValueUsd = Number(formatUnits((rwaUnits * tbill.nav) / RAY, 6));

  const totalValueUsd = walletValueUsd + lendSuppliedUsd - lendBorrowedUsd + yieldValueUsd + rwaValueUsd;
  const availableNowUsd = walletValueUsd;
  const lockedUsd = yieldLockedUsd;

  const positions = [
    ...SYMBOLS.filter((s) => lend.assets[s].supplied > 0n).map((s) => ({
      key: `lend-supply-${s}`,
      name: `${s} supplied (Lend)`,
      logo: TOKEN_LOGOS[s],
      valueUsd: toUsd(lend.assets[s].supplied, lend.assets[s].decimals, s),
      access: "Anytime, pool permitting",
    })),
    ...SYMBOLS.filter((s) => lend.assets[s].borrowed > 0n).map((s) => ({
      key: `lend-borrow-${s}`,
      name: `${s} borrowed (Lend)`,
      logo: TOKEN_LOGOS[s],
      valueUsd: -toUsd(lend.assets[s].borrowed, lend.assets[s].decimals, s),
      access: "Liability",
      isLiability: true,
    })),
    ...yieldRows.map((r) => ({
      key: `yield-${r.vaultId}`,
      name: r.name,
      logo: TOKEN_LOGOS[r.symbol],
      valueUsd: r.valueUsd,
      access: BigInt(Math.floor(Date.now() / 1000)) >= r.unlocksAt ? "Unlocked" : new Date(Number(r.unlocksAt) * 1000).toLocaleDateString(),
      accessWarn: BigInt(Math.floor(Date.now() / 1000)) < r.unlocksAt,
    })),
    ...(rwaUnits > 0n
      ? [{ key: "rwa", name: "RailFlow T-Bill", logo: TOKEN_LOGOS.USDC, valueUsd: rwaValueUsd, access: "Anytime, reserve permitting" }]
      : []),
  ];

  const activity = [
    ...agentDecisions.map((d) => ({
      time: d.timestamp,
      text: `Agent repaid ${Number(formatUnits(d.amount, 6)).toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC — utilization was ${(Number(d.utilizationBpsBefore) / 100).toFixed(1)}%`,
      logo: TOKEN_LOGOS.USDC,
      by: "agent",
      href: explorerTxUrl(d.txHash),
    })),
    ...swaps.map((s) => ({
      time: s.timestamp,
      text: `Swapped ${s.fromSymbol} → ${s.toSymbol}`,
      logo: TOKEN_LOGOS[s.fromSymbol],
      by: "you",
      href: explorerTxUrl(s.txHash),
    })),
  ]
    .sort((a, b) => b.time - a.time)
    .slice(0, 8);

  return (
    <div className={styles.page}>
      <div className={cx(styles.panel, styles.elevated)}>
        <p className={styles.statLabel}>Total portfolio</p>
        <p style={{ fontSize: 22, fontWeight: 500, margin: "0 0 2px" }}>{usd(totalValueUsd)}</p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 14px" }}>
          Live sum across your wallet, Lend, Yield and RWA positions on Arc Testnet.
        </p>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 14, marginTop: 6, borderTop: "1px solid var(--border)" }}>
          <span className={styles.panelTitle} style={{ margin: 0 }}>Your wallet</span>
        </div>
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span className={styles.colAsset} style={{ flex: 1.4 }}>Token</span>
            <span className={styles.colNum} style={{ flex: 1.2 }}>Balance</span>
            <span className={styles.colNum} style={{ flex: 1.1 }}>Value</span>
          </div>
          {walletRows.map((a) => (
            <div className={styles.tableRow} key={a.symbol} style={{ padding: "8px 0" }}>
              <span className={styles.colAsset} style={{ flex: 1.4 }}>
                <img className={styles.tokenLogo} src={TOKEN_LOGOS[a.symbol]} alt="" />
                {a.symbol}
              </span>
              <span className={cx(styles.colNum, styles.figures)} style={{ flex: 1.2 }}>
                {Number(formatUnits(a.balance, a.decimals)).toLocaleString("en-US", { maximumFractionDigits: 4 })}
              </span>
              <span className={cx(styles.colNum, styles.figures, styles.muted)} style={{ flex: 1.1 }}>{usd(a.valueUsd)}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "10px 0 0" }}>
          Prices from RailFlowLendingPool's on-chain rates, not a live market feed.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
        <div className={styles.panel}>
          <span style={{ fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <IconLayers size={16} />
            Liquidity
          </span>
          <div className={styles.kvRow}>
            <span className={styles.muted}>Available now (wallet)</span>
            <span className={styles.figures}>{usd(availableNowUsd)}</span>
          </div>
          <div className={styles.kvRow} style={{ marginBottom: 0 }}>
            <span className={styles.muted}>Locked in Yield vaults</span>
            <span className={styles.figures}>{usd(lockedUsd)}</span>
          </div>
        </div>

        <div className={styles.panel}>
          <span style={{ fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <IconShield size={16} />
            Debt guardrail
          </span>
          {mandate?.active ? (
            <>
              <div className={styles.kvRow}>
                <span className={styles.muted}>Utilization</span>
                <span className={styles.figures}>{(Number(mandate.currentUtilizationBps) / 100).toFixed(1)}%</span>
              </div>
              <div className={styles.kvRow} style={{ marginBottom: 0 }}>
                <span className={styles.muted}>Threshold</span>
                <span className={styles.figures}>{(Number(mandate.thresholdBps) / 100).toFixed(1)}%</span>
              </div>
            </>
          ) : (
            <p className={styles.panelSub} style={{ marginBottom: 0 }}>No active mandate — set one on the Agent page.</p>
          )}
        </div>
      </div>

      <div className={styles.panel}>
        <p className={styles.panelTitle}>All positions</p>
        {positions.length === 0 ? (
          <p className={styles.panelSub}>No open positions yet — supply, deposit or subscribe from Lend, Yield or RWA.</p>
        ) : (
          <div className={styles.table}>
            <div className={styles.tableHead}>
              <span className={styles.colAsset} style={{ flex: 2 }}>Position</span>
              <span className={styles.colNum}>Value</span>
              <span className={styles.colNum} style={{ flex: 1.2 }}>Access</span>
            </div>
            {positions.map((p) => (
              <div className={styles.tableRow} key={p.key} style={{ padding: "8px 0" }}>
                <span className={styles.colAsset} style={{ flex: 2 }}>
                  <img className={styles.tokenLogo} src={p.logo} alt="" />
                  {p.name}
                </span>
                <span className={cx(styles.colNum, styles.figures)} style={{ color: p.isLiability ? "var(--text-danger)" : undefined }}>
                  {p.isLiability ? `-${usd(-p.valueUsd)}` : usd(p.valueUsd)}
                </span>
                <span className={styles.colNum} style={{ flex: 1.2, color: p.accessWarn ? "var(--text-warning)" : "var(--text-secondary)" }}>
                  {p.access}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.panel}>
        <p className={styles.panelTitle}>Recent activity</p>
        {activity.length === 0 ? (
          <p className={styles.panelSub}>No agent or swap activity yet.</p>
        ) : (
          activity.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 11, padding: "8px 0", borderTop: "1px solid var(--border)", fontSize: 13, alignItems: "center" }}>
              <span className={cx(styles.figures, styles.muted)} style={{ fontSize: 12, minWidth: 68, flexShrink: 0 }}>
                {new Date(a.time).toLocaleDateString()}
              </span>
              <img className={styles.tokenLogo} src={a.logo} alt="" />
              <span style={{ flex: 1 }}>{a.text}</span>
              <span className={cx(styles.badge, a.by === "agent" && styles.isAgent)}>{a.by === "agent" ? "Agent" : "You"}</span>
              {a.href && (
                <a className={styles.linkButton} style={{ fontSize: 11 }} href={a.href} target="_blank" rel="noopener noreferrer">
                  View
                </a>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
