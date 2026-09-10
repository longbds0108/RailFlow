"use client";

import { useEffect, useRef, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { cx } from "../../../lib/cx";
import { TOKEN_LOGOS } from "../../../lib/logos";
import { BRIDGE_CHAINS, BRIDGE_CHAIN_KEYS } from "../../../lib/bridgeChains";
import { useWallet } from "../../../lib/useWallet";
import { useBridgeFlow, useMultiChainUsdcBalance } from "../../../lib/useBridge";
import {
  IconSwapHorizontal,
  IconCheckCircle,
  IconLoader,
  IconCircleEmpty,
  IconRoute,
  IconHistory,
  IconChevronDown,
  IconDroplet,
} from "../../../components/icons";
import styles from "../envelope.module.css";

const USDC_DECIMALS = 6;

function fmt(raw, fractionDigits = 4) {
  if (raw == null) return "—";
  const n = Number(formatUnits(raw, USDC_DECIMALS));
  return n.toLocaleString("en-US", { maximumFractionDigits: fractionDigits });
}

// Every step a real CCTP V2 "Standard Transfer" goes through, in order —
// drives both the progress tracker and the primary button's label.
const STEP_ORDER = ["switch-source", "approve", "burn", "attest", "switch-dest", "mint"];
function stepMeta(stepKey, from, to) {
  switch (stepKey) {
    case "switch-source":
      return { title: `Switch wallet to ${from.name}`, caption: "Confirm the network switch in your wallet" };
    case "approve":
      return { title: `Approve USDC on ${from.name}`, caption: "One-time allowance for Circle's TokenMessenger" };
    case "burn":
      return { title: `Burn USDC on ${from.name}`, caption: "depositForBurn — this is the irreversible step" };
    case "attest":
      return { title: "Waiting for Circle attestation", caption: "Iris signs the burn once it's final — can take a few minutes" };
    case "switch-dest":
      return { title: `Switch wallet to ${to.name}`, caption: "Confirm the network switch in your wallet" };
    case "mint":
      return { title: `Mint USDC on ${to.name}`, caption: "receiveMessage — completes the transfer" };
    default:
      return { title: stepKey, caption: "" };
  }
}

function explorerTxUrl(chainMeta, hash) {
  const base = chainMeta.chain.blockExplorers?.default?.url;
  return base && hash ? `${base}/tx/${hash}` : null;
}

// Trigger shows the selected chain's logo + name; the dropdown lists every
// option the same way, so the logo always travels with the network name.
function ChainPicker({ label, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div style={{ flex: 1 }}>
      <p className={styles.statLabel} style={{ marginBottom: 5 }}>{label}</p>
      <div className={styles.chainPicker} ref={ref}>
        <button
          type="button"
          className={cx(styles.chainTrigger, open && styles.isOpen)}
          onClick={() => setOpen((o) => !o)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`${label} chain`}
        >
          <img className={styles.tokenLogo} src={BRIDGE_CHAINS[value].logo} alt="" />
          <span className={styles.chainTriggerName}>{BRIDGE_CHAINS[value].name}</span>
          <span className={cx(styles.chainChevron, open && styles.isOpen)}>
            <IconChevronDown size={14} />
          </span>
        </button>
        {open && (
          <div className={styles.chainMenu} role="listbox">
            {BRIDGE_CHAIN_KEYS.map((c) => (
              <button
                type="button"
                key={c}
                role="option"
                aria-selected={c === value}
                className={cx(styles.chainOption, c === value && styles.isActive)}
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
              >
                <img className={styles.tokenLogo} src={BRIDGE_CHAINS[c].logo} alt="" />
                {BRIDGE_CHAINS[c].name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BridgePage() {
  const { address, isConnected } = useWallet();
  const [fromKey, setFromKey] = useState("Arc");
  const [toKey, setToKey] = useState("Base");
  const [amount, setAmount] = useState("");
  const [balanceRefresh, setBalanceRefresh] = useState(0);
  const [history, setHistory] = useState([]);
  const recordedForRef = useRef(null);

  const { balances } = useMultiChainUsdcBalance(address, balanceRefresh);
  const { step, error, burnTxHash, mintTxHash, run, reset } = useBridgeFlow();

  const from = BRIDGE_CHAINS[fromKey];
  const to = BRIDGE_CHAINS[toKey];
  const running = step !== "idle" && step !== "done";

  // Record a completed transfer once, then refresh both chains' balances.
  useEffect(() => {
    if (step === "done" && recordedForRef.current !== mintTxHash) {
      recordedForRef.current = mintTxHash;
      setHistory((h) => [{ fromKey, toKey, amount, burnTxHash, mintTxHash, at: Date.now() }, ...h]);
      setBalanceRefresh((k) => k + 1);
    }
  }, [step, mintTxHash, fromKey, toKey, amount, burnTxHash]);

  const handleAmountChange = (e) => {
    const v = e.target.value;
    if (v === "" || /^\d*\.?\d*$/.test(v)) setAmount(v);
  };
  const handleFromChange = (key) => {
    if (key === toKey) setToKey(fromKey);
    setFromKey(key);
  };
  const handleToChange = (key) => {
    if (key === fromKey) setFromKey(toKey);
    setToKey(key);
  };
  const flip = () => {
    setFromKey(toKey);
    setToKey(fromKey);
  };

  const fromBalance = balances[fromKey];
  const amountRaw = (() => {
    try {
      return amount ? parseUnits(amount, USDC_DECIMALS) : 0n;
    } catch {
      return 0n;
    }
  })();
  const insufficientBalance = fromBalance != null && amountRaw > fromBalance;
  const canSubmit = isConnected && amountRaw > 0n && !insufficientBalance && !running;

  const handleSubmit = () => {
    if (!canSubmit || !address) return;
    run({ fromKey, toKey, amount, recipient: address });
  };
  const handleNewTransfer = () => {
    reset();
    setAmount("");
  };

  const primaryLabel = running
    ? stepMeta(step, from, to).title
    : error && burnTxHash
      ? "Retry from attestation"
      : error
        ? "Retry bridge"
        : "Bridge USDC";

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <span className={styles.eyebrow}>Arc Testnet · Railflow Protocol</span>
        <h1>Bridge</h1>
        <p className={styles.lead}>
          Real native USDC across chains via Circle's CCTP — you sign a burn on the source chain and a mint on the
          destination chain yourself, no relayer or custodian in between.
        </p>
      </div>

      <div className={styles.statGrid}>
        {BRIDGE_CHAIN_KEYS.map((key) => {
          const c = BRIDGE_CHAINS[key];
          return (
            <div className={styles.statTile} key={key}>
              <div className={styles.statIcon}>
                <img className={styles.tokenLogo} src={c.logo} alt="" />
              </div>
              <div className={styles.statBody}>
                <p className={styles.statLabel}>{c.name}</p>
                <p className={styles.statValue}>
                  {isConnected ? fmt(balances[key], 2) : "—"}
                  <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 400 }}> USDC</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.twoColGrid}>
        <div className={cx(styles.panel, styles.elevated)}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 12 }}>
            <ChainPicker label="From" value={fromKey} onChange={handleFromChange} disabled={running} />
            <button
              className={styles.iconButton}
              onClick={flip}
              disabled={running}
              aria-label="Flip bridge direction"
              style={{ marginBottom: 2 }}
            >
              <IconSwapHorizontal />
            </button>
            <ChainPicker label="To" value={toKey} onChange={handleToChange} disabled={running} />
          </div>

          <p className={styles.statLabel} style={{ marginBottom: 6 }}>Amount</p>
          <div className={styles.amountBox}>
            <input
              className={styles.amountInput}
              value={amount}
              onChange={handleAmountChange}
              inputMode="decimal"
              placeholder="0"
              disabled={running}
              aria-label="Amount to bridge"
            />
            <span className={styles.amountToken}>
              <img className={styles.tokenLogo} src={TOKEN_LOGOS.USDC} alt="" />
              USDC
            </span>
          </div>
          <p className={styles.walletNote}>
            {isConnected ? `Balance ${fmt(fromBalance, 6)}` : "Connect your wallet to see your balance"} ·{" "}
            <button
              className={styles.maxLink}
              disabled={running || fromBalance == null}
              onClick={() => setAmount(formatUnits(fromBalance, USDC_DECIMALS))}
            >
              Max
            </button>
          </p>
          {insufficientBalance && (
            <p style={{ fontSize: 11, color: "var(--text-danger)", marginTop: -8, marginBottom: 12 }}>
              Amount exceeds your {from.name} balance.
            </p>
          )}

          <div className={styles.kvRow}>
            <span className={styles.muted}>Route</span>
            <span>CCTP V2 · Standard Transfer</span>
          </div>
          <div className={styles.kvRow}>
            <span className={styles.muted}>You receive</span>
            <span className={styles.figures}>{amount || "0"} USDC</span>
          </div>
          <div className={styles.kvRow} style={{ marginBottom: 16 }}>
            <span className={styles.muted}>Fee</span>
            <span className={styles.figures}>0 (Standard Transfer)</span>
          </div>

          {step === "done" ? (
            <button className={styles.ctaButton} onClick={handleNewTransfer}>
              Start a new transfer
            </button>
          ) : (
            <button className={styles.ctaButton} onClick={handleSubmit} disabled={!canSubmit}>
              {primaryLabel}
            </button>
          )}
          {error && (
            <p style={{ fontSize: 11, color: "var(--text-danger)", marginTop: 8 }}>{error}</p>
          )}

          <div className={styles.tipBanner}>
            <span className={styles.tipIcon}>
              <IconDroplet />
            </span>
            <div>
              <p className={styles.tipTitle}>Need testnet gas?</p>
              <p className={styles.tipText}>
                You'll sign a transaction on both {from.name} and {to.name}, so you need each chain's native gas
                token in your wallet, not just USDC.
                <br />
                <a className={styles.tipLink} href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer">
                  faucet.circle.com <span aria-hidden="true">↗</span>
                </a>
              </p>
            </div>
          </div>
        </div>

        <div className={styles.sideCol}>
          <div className={styles.panel}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span className={styles.panelTitleIcon}>
                  <IconRoute size={16} />
                </span>
                <span className={styles.panelTitle} style={{ margin: 0 }}>
                  {step === "idle" ? "How it works" : "This transfer"}
                </span>
              </span>
              {step !== "idle" && (
                <span className={cx(styles.figures, styles.muted)} style={{ fontSize: 12 }}>
                  {amount} USDC · {from.name} → {to.name}
                </span>
              )}
            </div>
            {STEP_ORDER.map((s) => {
              const currentIdx = STEP_ORDER.indexOf(step);
              const idx = STEP_ORDER.indexOf(s);
              const isDone = step === "done" || (currentIdx > -1 && idx < currentIdx);
              const isFailed = s === step && Boolean(error);
              const isActive = s === step && !error && step !== "idle";
              const meta = stepMeta(s, from, to);
              return (
                <div className={styles.timelineStep} key={s}>
                  <span
                    className={styles.timelineIcon}
                    style={{
                      color: isFailed
                        ? "var(--text-danger)"
                        : isDone
                          ? "var(--text-success)"
                          : isActive
                            ? "var(--text-accent)"
                            : "var(--text-muted)",
                    }}
                  >
                    {isDone && <IconCheckCircle />}
                    {isActive && (
                      <span className={styles.spin} style={{ display: "inline-flex" }}>
                        <IconLoader />
                      </span>
                    )}
                    {!isDone && !isActive && <IconCircleEmpty />}
                  </span>
                  <div>
                    <p
                      className={styles.timelineTitle}
                      style={{ color: !isDone && !isActive && !isFailed ? "var(--text-secondary)" : "var(--text-primary)" }}
                    >
                      {meta.title}
                    </p>
                    <p className={styles.timelineCaption}>{isFailed ? error : meta.caption}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={cx(styles.panel, styles.agentPanel)}>
            <div className={styles.agentPanelHead}>
              <span className={styles.agentMark} aria-hidden="true">✳</span>
              <p className={styles.panelTitle}>Rather not sign every step?</p>
            </div>
            <p className={styles.panelSub}>
              The agent can watch a burn's attestation and complete the mint for you, inside limits you sign once.
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
          <p className={styles.panelTitle}>This session's transfers</p>
        </div>
        {history.length === 0 ? (
          <p className={styles.panelSub}>
            No transfers yet this session — completed bridges appear here with links to both transactions.
          </p>
        ) : (
          <div className={styles.table}>
            <div className={styles.tableHead}>
              <span className={styles.colAsset} style={{ flex: 1.8 }}>Route</span>
              <span className={styles.colNum}>Amount</span>
              <span className={styles.colNum} style={{ flex: 1.4 }}>Burn tx</span>
              <span className={styles.colNum} style={{ flex: 1.4 }}>Mint tx</span>
            </div>
            {history.map((t, i) => {
              const f = BRIDGE_CHAINS[t.fromKey];
              const d = BRIDGE_CHAINS[t.toKey];
              return (
                <div className={styles.tableRow} key={i}>
                  <span className={styles.colAsset} style={{ flex: 1.8 }}>
                    <span style={{ display: "inline-flex", alignItems: "center" }}>
                      <img className={styles.tokenLogo} src={f.logo} alt="" style={{ marginRight: -6, zIndex: 1 }} />
                      <img className={styles.tokenLogo} src={d.logo} alt="" />
                    </span>
                    {f.name} → {d.name}
                  </span>
                  <span className={cx(styles.colNum, styles.figures, styles.muted)}>{t.amount} USDC</span>
                  <span className={styles.colNum} style={{ flex: 1.4 }}>
                    <a className={styles.tipLink} href={explorerTxUrl(f, t.burnTxHash)} target="_blank" rel="noopener noreferrer">
                      View ↗
                    </a>
                  </span>
                  <span className={styles.colNum} style={{ flex: 1.4 }}>
                    <a className={styles.tipLink} href={explorerTxUrl(d, t.mintTxHash)} target="_blank" rel="noopener noreferrer">
                      View ↗
                    </a>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
