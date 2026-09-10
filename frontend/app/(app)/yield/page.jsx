"use client";

import { useEffect, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useSwitchChain } from "wagmi";
import { cx } from "../../../lib/cx";
import { TOKEN_LOGOS } from "../../../lib/logos";
import { TOKENS, ENV } from "../../../lib/config";
import { useWallet } from "../../../lib/useWallet";
import { useApproveToken } from "../../../lib/useLendingPool";
import { YIELD_VAULT_ADDRESS, YIELD_VAULTS } from "../../../lib/yieldVaultContract";
import { useYieldPositions, useVaultDeposit, useVaultWithdraw } from "../../../lib/useYieldVault";
import { IconLayers, IconPercent, IconClock, IconLock, IconWallet } from "../../../components/icons";
import styles from "../envelope.module.css";

function fmt(raw, decimals, fractionDigits = 4) {
  if (raw == null) return "0";
  const n = Number(formatUnits(raw, decimals));
  return n.toLocaleString("en-US", { maximumFractionDigits: fractionDigits });
}
function bpsToPct(bps) {
  return (Number(bps) / 100).toFixed(2);
}
function daysFromSeconds(sec) {
  return Math.round(Number(sec) / 86400);
}

export default function YieldPage() {
  const { address, isConnected, correctNetwork } = useWallet();
  const { switchChain, isPending: switchingChain } = useSwitchChain();
  const [refreshKey, setRefreshKey] = useState(0);
  const [index, setIndex] = useState(0);
  const [amount, setAmount] = useState("");

  const { data: vaults, loading } = useYieldPositions(address, refreshKey);
  const approve = useApproveToken(vaults?.[index]?.asset);
  const deposit = useVaultDeposit();
  const withdraw = useVaultWithdraw();

  useEffect(() => {
    if (approve.isConfirmed || deposit.isConfirmed || withdraw.isConfirmed) {
      setRefreshKey((k) => k + 1);
    }
    if (deposit.isConfirmed || withdraw.isConfirmed) {
      setAmount("");
      approve.reset();
      deposit.reset();
      withdraw.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approve.isConfirmed, deposit.isConfirmed, withdraw.isConfirmed]);

  const handleSelect = (i) => {
    setIndex(i);
    setAmount("");
    approve.reset();
    deposit.reset();
  };
  const handleAmountChange = (e) => {
    const v = e.target.value;
    if (v === "" || /^\d*\.?\d*$/.test(v)) setAmount(v);
  };

  if (!isConnected || !correctNetwork || !vaults) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHead}>
          <span className={styles.eyebrow}>Arc Testnet · Railflow Protocol</span>
          <h1>Yield</h1>
          <p className={styles.lead}>
            Real fixed-term vaults — deposit, earn simple interest at the vault's rate, withdraw once the lock is
            over. No early exit.
          </p>
        </div>
        <div className={styles.noteBanner}>
          <p className={styles.noteText}>
            {!isConnected
              ? "Connect your wallet to see your real vault positions."
              : !correctNetwork
                ? "Yield runs on Arc Testnet — the network your wallet is on doesn't have this contract."
                : loading
                  ? "Loading vault data…"
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

  const vault = vaults[index];
  const asset = TOKENS[vault.symbol];
  const hasOpenPosition = vault.principal > 0n;
  const isUnlocked = hasOpenPosition && BigInt(Math.floor(Date.now() / 1000)) >= vault.unlocksAt;
  const unlocksOnDate = hasOpenPosition ? new Date(Number(vault.unlocksAt) * 1000) : null;

  const totalInVaults = YIELD_VAULTS.reduce((sum, { vaultId }) => {
    const v = vaults[vaultId];
    const priceUsd = v.symbol === "cirBTC" ? 65000 : v.symbol === "EURC" ? 1.157 : 1;
    return sum + Number(formatUnits(v.principal, TOKENS[v.symbol].decimals)) * priceUsd;
  }, 0);
  const weightedApy = (() => {
    let weighted = 0;
    let totalUsd = 0;
    for (const { vaultId } of YIELD_VAULTS) {
      const v = vaults[vaultId];
      const priceUsd = v.symbol === "cirBTC" ? 65000 : v.symbol === "EURC" ? 1.157 : 1;
      const usd = Number(formatUnits(v.principal, TOKENS[v.symbol].decimals)) * priceUsd;
      weighted += usd * (Number(v.apyBps) / 100);
      totalUsd += usd;
    }
    return totalUsd > 0 ? weighted / totalUsd : 0;
  })();
  const nextUnlock = YIELD_VAULTS.map(({ vaultId }) => vaults[vaultId])
    .filter((v) => v.principal > 0n)
    .sort((a, b) => Number(a.unlocksAt - b.unlocksAt))[0];
  const daysToNextUnlock = nextUnlock ? Math.max(0, Math.ceil((Number(nextUnlock.unlocksAt) * 1000 - Date.now()) / 86400000)) : null;

  const STAT_TILES = [
    { key: "inVaults", label: "In yield vaults", value: `$${totalInVaults.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, icon: <IconLayers /> },
    { key: "apy", label: "Weighted APY", value: totalInVaults > 0 ? `${weightedApy.toFixed(2)}%` : "—", icon: <IconPercent /> },
    { key: "unlock", label: "Next unlock", value: daysToNextUnlock != null ? String(daysToNextUnlock) : "—", suffix: daysToNextUnlock != null ? " days" : "", icon: <IconClock />, accent: true },
    { key: "positions", label: "Open positions", value: String(YIELD_VAULTS.filter(({ vaultId }) => vaults[vaultId].principal > 0n).length), icon: <IconLock /> },
  ];

  const amountRaw = (() => {
    try {
      return amount ? parseUnits(amount, asset.decimals) : 0n;
    } catch {
      return 0n;
    }
  })();
  const needsApprove = amountRaw > 0n && vault.allowance < amountRaw;
  const canDeposit = !hasOpenPosition && amountRaw > 0n && amountRaw <= vault.balance && vault.active;
  const busy = approve.isPending || approve.isConfirming || deposit.isPending || deposit.isConfirming || withdraw.isPending || withdraw.isConfirming;

  const depositLabel = needsApprove
    ? approve.isPending
      ? "Confirm approval…"
      : approve.isConfirming
        ? "Approving…"
        : `Approve ${vault.symbol}`
    : deposit.isPending
      ? "Confirm in wallet…"
      : deposit.isConfirming
        ? "Depositing…"
        : "Deposit and lock";

  const handlePrimary = () => {
    if (needsApprove) {
      approve.write([YIELD_VAULT_ADDRESS, parseUnits("1000000000", asset.decimals)]);
    } else if (canDeposit) {
      deposit.write([BigInt(vault.vaultId), amountRaw]);
    }
  };
  const handleWithdraw = () => withdraw.write([BigInt(vault.vaultId)]);

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <span className={styles.eyebrow}>Arc Testnet · Railflow Protocol</span>
        <h1>Yield</h1>
        <p className={styles.lead}>
          Real fixed-term vaults on RailFlowYieldVault. Deposit, earn simple interest at the vault's rate the whole
          time you're locked, withdraw principal + interest once it matures. No early exit.
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
          <p className={styles.panelSub}>Reserve is what's actually available on-chain to pay out interest.</p>
          <div className={styles.table}>
            <div className={styles.tableHead}>
              <span className={styles.colAsset} style={{ flex: 1.8 }}>Vault</span>
              <span className={styles.colNum}>APY</span>
              <span className={styles.colNum}>Lock</span>
              <span className={styles.colNum} style={{ flex: 1.1 }}>Reserve</span>
            </div>
            {YIELD_VAULTS.map(({ vaultId, name, symbol }, i) => {
              const v = vaults[vaultId];
              return (
                <button key={vaultId} className={cx(styles.tableRow, i === index && styles.isSelected)} onClick={() => handleSelect(i)}>
                  <span className={styles.colAsset} style={{ flex: 1.8 }}>
                    <img className={styles.tokenLogo} src={TOKEN_LOGOS[symbol]} alt="" />
                    {name} · {symbol}
                  </span>
                  <span className={cx(styles.colNum, styles.figures)}>{bpsToPct(v.apyBps)}%</span>
                  <span className={cx(styles.colNum, styles.muted)}>{daysFromSeconds(v.lockSeconds)}d</span>
                  <span className={cx(styles.colNum, styles.figures, styles.muted)} style={{ flex: 1.1 }}>
                    {fmt(v.rewardReserve, TOKENS[symbol].decimals, 2)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.sideCol}>
          <div className={cx(styles.panel, styles.elevated)}>
            <div className={styles.tokenTabs}>
              {YIELD_VAULTS.map(({ vaultId, name, symbol }, i) => (
                <button key={vaultId} className={cx(styles.tokenChip, i === index && styles.isActive)} onClick={() => handleSelect(i)}>
                  <img className={styles.tokenChipLogo} src={TOKEN_LOGOS[symbol]} alt="" />
                  {name}
                </button>
              ))}
            </div>

            {hasOpenPosition ? (
              <>
                <div className={styles.kvRow}>
                  <span className={styles.muted}>Principal</span>
                  <span className={styles.figures}>{fmt(vault.principal, asset.decimals, 6)} {vault.symbol}</span>
                </div>
                <div className={styles.kvRow}>
                  <span className={styles.muted}>Accrued interest</span>
                  <span className={cx(styles.figures, styles.kvPositive)}>{fmt(vault.pendingInterest, asset.decimals, 6)} {vault.symbol}</span>
                </div>
                <div className={styles.kvRow} style={{ marginBottom: 16 }}>
                  <span className={styles.muted}>{isUnlocked ? "Unlocked" : "Unlocks on"}</span>
                  <span className={styles.figures}>{unlocksOnDate.toLocaleString()}</span>
                </div>
                <button className={styles.ctaButton} onClick={handleWithdraw} disabled={!isUnlocked || busy}>
                  {withdraw.isPending ? "Confirm in wallet…" : withdraw.isConfirming ? "Withdrawing…" : isUnlocked ? "Withdraw" : "Still locked"}
                </button>
                {withdraw.error && <p style={{ fontSize: 11, color: "var(--text-danger)", marginTop: 8 }}>{withdraw.error.shortMessage || "Transaction failed."}</p>}
              </>
            ) : (
              <>
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
                    <img className={styles.tokenLogo} src={TOKEN_LOGOS[vault.symbol]} alt="" />
                    {vault.symbol}
                  </span>
                </div>
                <p className={styles.walletNote}>
                  Wallet balance {fmt(vault.balance, asset.decimals, 6)} ·{" "}
                  <button className={styles.maxLink} onClick={() => setAmount(formatUnits(vault.balance, asset.decimals))}>
                    Max
                  </button>
                </p>

                <div className={styles.kvRow}>
                  <span className={styles.muted}>APY</span>
                  <span className={styles.figures}>{bpsToPct(vault.apyBps)}%</span>
                </div>
                <div className={styles.kvRow} style={{ marginBottom: 16 }}>
                  <span className={styles.muted}>Lock period</span>
                  <span className={styles.figures}>{daysFromSeconds(vault.lockSeconds)} days</span>
                </div>

                <button className={styles.ctaButton} onClick={handlePrimary} disabled={busy || (!needsApprove && !canDeposit)}>
                  {depositLabel}
                </button>
                {(approve.error || deposit.error) && (
                  <p style={{ fontSize: 11, color: "var(--text-danger)", marginTop: 8 }}>
                    {(approve.error || deposit.error).shortMessage || "Transaction failed."}
                  </p>
                )}
              </>
            )}
          </div>

          <div className={styles.warningBanner}>
            <span className={styles.warningIcon}>
              <IconLock />
            </span>
            <p className={styles.warningText}>
              There is no early exit. Don't deposit funds you may need before the lock ends — the contract simply
              won't let you withdraw until then.
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
        {YIELD_VAULTS.filter(({ vaultId }) => vaults[vaultId].principal > 0n).length === 0 ? (
          <p className={styles.panelSub}>No open positions yet — deposit into a vault above to see it here.</p>
        ) : (
          YIELD_VAULTS.filter(({ vaultId }) => vaults[vaultId].principal > 0n).map(({ vaultId, name, symbol }) => {
            const v = vaults[vaultId];
            const dec = TOKENS[symbol].decimals;
            const totalDuration = Number(v.unlocksAt - v.depositedAt);
            const elapsed = Math.min(totalDuration, Math.max(0, Date.now() / 1000 - Number(v.depositedAt)));
            const pct = totalDuration > 0 ? Math.round((elapsed / totalDuration) * 100) : 100;
            const daysLeft = Math.max(0, Math.ceil((Number(v.unlocksAt) * 1000 - Date.now()) / 86400000));
            return (
              <div className={styles.positionCard} key={vaultId}>
                <div className={styles.positionHead}>
                  <span style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 7 }}>
                    <img className={styles.tokenLogo} src={TOKEN_LOGOS[symbol]} alt="" style={{ width: 16, height: 16 }} />
                    {name} · {symbol}
                  </span>
                  <span className={cx(styles.figures, styles.muted)} style={{ fontSize: 13 }}>
                    {fmt(v.principal, dec, 4)} + {fmt(v.pendingInterest, dec, 4)} · {bpsToPct(v.apyBps)}%
                  </span>
                </div>
                <div className={styles.meter}>
                  <span className={styles.meterFill} style={{ width: `${pct}%` }} />
                </div>
                <p className={styles.positionCaption}>
                  Unlocks {new Date(Number(v.unlocksAt) * 1000).toLocaleDateString()} · {daysLeft} days left
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
