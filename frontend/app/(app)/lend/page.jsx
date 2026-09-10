"use client";

import { useEffect, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useSwitchChain } from "wagmi";
import { cx } from "../../../lib/cx";
import { TOKEN_LOGOS } from "../../../lib/logos";
import { TOKENS, ENV } from "../../../lib/config";
import { useWallet } from "../../../lib/useWallet";
import { LENDING_POOL_ADDRESS } from "../../../lib/lendingPoolContract";
import { useLendingPoolPosition, useApproveToken, useSupply, useWithdraw, useBorrow, useRepay } from "../../../lib/useLendingPool";
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

const SYMBOLS = ["USDC", "EURC", "cirBTC"];
const USDC_DECIMALS = TOKENS.USDC.decimals;

function fmt(raw, decimals, fractionDigits = 4) {
  if (raw == null) return "0";
  const n = Number(formatUnits(raw, decimals));
  return n.toLocaleString("en-US", { maximumFractionDigits: fractionDigits });
}
function fmtUsd(raw, fractionDigits = 2) {
  return `$${fmt(raw, USDC_DECIMALS, fractionDigits)}`;
}

const MODES = {
  supply: { label: "Supply", needsApprove: true },
  withdraw: { label: "Withdraw", needsApprove: false },
  borrow: { label: "Borrow", needsApprove: false },
  repay: { label: "Repay", needsApprove: true },
};

// Real on-chain Lend flow against the deployed RailFlowLendingPool contract:
// supply USDC/EURC/cirBTC as collateral, borrow any of the three against
// your combined collateral value, repay, withdraw.
function RealLend() {
  const { address, isConnected, correctNetwork } = useWallet();
  const { switchChain, isPending: switchingChain } = useSwitchChain();
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, loading, error } = useLendingPoolPosition(address, refreshKey);

  const [symbolIndex, setSymbolIndex] = useState(0);
  const [mode, setMode] = useState("supply");
  const [amount, setAmount] = useState("");
  const symbol = SYMBOLS[symbolIndex];
  const tokenAddress = TOKENS[symbol].address;
  const modeConfig = MODES[mode];

  const approveToken = useApproveToken(tokenAddress);
  const supply = useSupply();
  const withdraw = useWithdraw();
  const borrow = useBorrow();
  const repay = useRepay();

  const actionByMode = { supply, withdraw, borrow, repay };
  const action = actionByMode[mode];
  const approve = modeConfig.needsApprove ? approveToken : null;

  // Refetch every asset's position + allowance after any confirmed
  // transaction, and clear the amount field once the action lands.
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
    approveToken.reset();
    supply.reset();
    withdraw.reset();
    borrow.reset();
    repay.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, symbol]);

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
            Supply USDC, EURC or cirBTC as collateral and borrow any of the three against it — live on
            RailFlowLendingPool.
          </p>
        </div>
        <div className={styles.noteBanner}>
          <p className={styles.noteText}>
            {!isConnected
              ? "Connect your wallet to see your real collateral and loan position."
              : !correctNetwork
                ? "Lend only runs on Arc Testnet — the network your wallet just switched to doesn't have this contract."
                : loading
                  ? "Loading your position from the RailFlowLendingPool contract…"
                  : error
                    ? `Couldn't read the contract: ${error}`
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

  const asset = data.assets[symbol];
  const priceWhole = Number(formatUnits(asset.priceInUsdc, USDC_DECIMALS));
  const suppliedUsd = Number(formatUnits(asset.supplied, asset.decimals)) * priceWhole;

  const availableUsdRaw = data.collateralValue > data.borrowValue ? data.collateralValue - data.borrowValue : 0n;
  const utilizationPct = data.collateralValue > 0n ? Math.min(100, (Number(data.borrowValue) / Number(data.collateralValue)) * 100) : 0;
  const utilZone = utilizationPct < 60 ? "safe" : utilizationPct < 85 ? "caution" : "risk";

  // "Max" for borrow/repay is computed in the selected token's own units —
  // repay is capped by wallet balance too (can't repay more than you hold).
  const availableToBorrowInToken =
    priceWhole > 0 ? parseUnits((Number(formatUnits(availableUsdRaw, USDC_DECIMALS)) / priceWhole).toFixed(asset.decimals), asset.decimals) : 0n;
  const liquidityCappedBorrow = availableToBorrowInToken < asset.liquidity ? availableToBorrowInToken : asset.liquidity;

  const maxByMode = {
    supply: asset.balance,
    withdraw: asset.supplied,
    borrow: liquidityCappedBorrow,
    repay: asset.borrowed < asset.balance ? asset.borrowed : asset.balance,
  };

  const amountRaw = (() => {
    try {
      return amount ? parseUnits(amount, asset.decimals) : 0n;
    } catch {
      return 0n;
    }
  })();
  const needsApprove = modeConfig.needsApprove && amountRaw > 0n && asset.allowance < amountRaw;

  const busy = approve?.isPending || approve?.isConfirming || action.isPending || action.isConfirming;
  const spenderAmount = parseUnits("1000000000", asset.decimals); // one-time approval per token

  const primaryLabel = needsApprove
    ? approve.isPending
      ? "Confirm approval…"
      : approve.isConfirming
        ? "Approving…"
        : `Approve ${symbol}`
    : action.isPending
      ? "Confirm in wallet…"
      : action.isConfirming
        ? "Confirming…"
        : `${modeConfig.label} ${symbol}`;

  const handlePrimary = () => {
    if (amountRaw <= 0n) return;
    if (needsApprove) {
      approve.write([LENDING_POOL_ADDRESS, spenderAmount]);
    } else {
      action.write([tokenAddress, amountRaw]);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <span className={styles.eyebrow}>Arc Testnet · Railflow Protocol</span>
        <h1>Lend</h1>
        <p className={styles.lead}>
          Supply USDC, EURC or cirBTC from your own wallet, and borrow any of the three against your combined
          collateral. Every action is a transaction you sign yourself.
        </p>
      </div>

      <div className={styles.statGrid}>
        <div className={styles.statTile}>
          <div className={styles.statIcon} style={{ color: "var(--text-accent)" }}>
            <IconLayers />
          </div>
          <div className={styles.statBody}>
            <p className={styles.statLabel}>My collateral value</p>
            <p className={styles.statValue}>{fmtUsd(data.collateralValue, 2)}</p>
          </div>
        </div>
        <div className={styles.statTile}>
          <div className={styles.statIcon} style={{ color: "var(--text-accent)" }}>
            <IconWallet />
          </div>
          <div className={styles.statBody}>
            <p className={styles.statLabel}>Borrowed</p>
            <p className={styles.statValue}>{fmtUsd(data.borrowValue, 2)}</p>
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
            <p className={styles.statLabel}>{symbol} pool liquidity</p>
            <p className={styles.statValue}>{fmt(asset.liquidity, asset.decimals, 2)}</p>
          </div>
        </div>
      </div>

      <div className={styles.twoColGrid}>
        <div className={styles.panel}>
          <div className={styles.panelTitleRow}>
            <span className={styles.panelTitleIcon}>
              <IconLayers size={16} />
            </span>
            <p className={styles.panelTitle}>Markets</p>
          </div>
          <p className={styles.panelSub}>All three assets can be supplied as collateral or borrowed.</p>
          <div className={styles.table}>
            <div className={styles.tableHead}>
              <span className={styles.colAsset}>Asset</span>
              <span className={styles.colNum}>Price</span>
              <span className={styles.colNum}>LTV</span>
              <span className={styles.colNum}>My supply</span>
              <span className={styles.colNum}>My borrow</span>
            </div>
            {SYMBOLS.map((s, i) => {
              const a = data.assets[s];
              return (
                <button
                  key={s}
                  className={cx(styles.tableRow, i === symbolIndex && styles.isSelected)}
                  onClick={() => setSymbolIndex(i)}
                >
                  <span className={styles.colAsset}>
                    <img className={styles.tokenLogo} src={TOKEN_LOGOS[s]} alt="" />
                    {s}
                  </span>
                  <span className={cx(styles.colNum, styles.figures, styles.muted)}>
                    ${Number(formatUnits(a.priceInUsdc, USDC_DECIMALS)).toLocaleString("en-US")}
                  </span>
                  <span className={cx(styles.colNum, styles.muted)}>{(Number(a.collateralFactorBps) / 100).toFixed(0)}%</span>
                  <span className={cx(styles.colNum, styles.figures)}>{fmt(a.supplied, a.decimals, 4)}</span>
                  <span className={cx(styles.colNum, styles.figures, styles.muted)}>{fmt(a.borrowed, a.decimals, 4)}</span>
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12 }}>
            No price oracle on testnet — prices are set by the contract owner, not a live feed.
          </p>
        </div>

        <div className={styles.sideCol}>
          <div className={cx(styles.panel, styles.elevated)}>
            <div className={styles.tokenTabs}>
              {SYMBOLS.map((s, i) => (
                <button
                  key={s}
                  className={cx(styles.tokenChip, i === symbolIndex && styles.isActive)}
                  onClick={() => setSymbolIndex(i)}
                >
                  <img className={styles.tokenChipLogo} src={TOKEN_LOGOS[s]} alt="" />
                  {s}
                </button>
              ))}
            </div>

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
                aria-label={`Amount of ${symbol} to ${mode}`}
              />
              <span className={styles.amountToken}>
                <img className={styles.tokenLogo} src={TOKEN_LOGOS[symbol]} alt="" />
                {symbol}
              </span>
            </div>
            <p className={styles.walletNote}>
              {mode === "supply" && `Wallet balance ${fmt(asset.balance, asset.decimals, 6)}`}
              {mode === "withdraw" && `Supplied ${fmt(asset.supplied, asset.decimals, 6)}`}
              {mode === "borrow" && `Available to borrow ${fmt(liquidityCappedBorrow, asset.decimals, 6)}`}
              {mode === "repay" && `Outstanding loan ${fmt(asset.borrowed, asset.decimals, 6)}`} ·{" "}
              <button className={styles.maxLink} onClick={() => setAmount(formatUnits(maxByMode[mode], asset.decimals))}>
                Max
              </button>
            </p>

            <div className={styles.kvRow}>
              <span className={styles.muted}>{symbol} value supplied</span>
              <span className={styles.figures}>{fmtUsd(parseUnits(suppliedUsd.toFixed(2), USDC_DECIMALS))}</span>
            </div>
            <div className={styles.kvRow} style={{ marginBottom: 16 }}>
              <span className={styles.muted}>Available to borrow (all assets)</span>
              <span className={styles.figures}>{fmtUsd(availableUsdRaw)}</span>
            </div>

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
  if (!LENDING_POOL_ADDRESS) return <IllustrativeLend />;
  return <RealLend />;
}
