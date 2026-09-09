"use client";

import { useEffect, useState } from "react";
import { cx } from "../../../lib/cx";
import { TOKEN_LOGOS } from "../../../lib/logos";
import { IconWallet, IconHistory, IconCalendar, IconShieldCheck, IconCheckCircle, IconArrowUp } from "../../../components/icons";
import styles from "../envelope.module.css";

function formatRelativeTime(fromMs, nowMs) {
  const diffSec = Math.max(0, Math.floor((nowMs - fromMs) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

const STAT_TILES = [
  { key: "aum", label: "Under management", value: "$48,200", icon: <IconWallet /> },
  { key: "decisions", label: "Decisions, 30d", value: "214", icon: <IconHistory /> },
  { key: "expires", label: "Mandate expires", value: "24", suffix: " days", icon: <IconCalendar /> },
  { key: "breaches", label: "Limit breaches", value: "0", icon: <IconShieldCheck size={18} />, success: true },
];

const STANCE_TAGS = ["Range", "Bull macro", "Stress +0.4"];

const SLEEVES = [
  { name: "T0 cash", target: "20%", actual: "20%", value: "$9,600" },
  { name: "T1 lending", target: "48%", actual: "50%", value: "$24,100" },
  { name: "T2 yield", target: "15%", actual: "13%", value: "$6,200" },
  { name: "T3 RWA", target: "17%", actual: "17%", value: "$8,300" },
];

const LIMITS = [
  { label: "Capital deployed", used: 80, max: 100, display: "80 / 100%" },
  { label: "Turnover today", used: 3.2, max: 10, display: "3.2 / 10%" },
  { label: "Slow sleeves", used: 30, max: 40, display: "30 / 40%" },
];

const DECISIONS = [
  {
    time: "11:32",
    title: "Held off rotating into Euro Yield",
    desc: "Would have passed the daily turnover cap.",
    status: "skip",
    logo: TOKEN_LOGOS.EURC,
  },
  {
    time: "09:05",
    title: "Rotated $4,200 into T-bills",
    desc: "Regime turned range.",
    status: "exec",
    logo: TOKEN_LOGOS.USDC,
  },
  {
    time: "02:14",
    title: "Health factor 1.61, deleveraged to 2.30",
    desc: "Repaid $2,800 of borrow.",
    status: "exec",
    logo: TOKEN_LOGOS.USDC,
  },
];

const SUGGESTIONS = ["Why the last skip?", "What if I raise a limit?", "I'll need cash soon"];

const INITIAL_MESSAGES = [
  { role: "user", text: "Why are you 17% in T-bills?" },
  {
    role: "agent",
    text: "Range regime with stretched positioning means directional risk pays poorly right now, so I park capital in carry instead of cash. T-bills yield 4.80% against 0% idle, and the redemption window is short enough to stay inside your liquidity limit.",
    link: "See the 09:05 entry",
  },
  { role: "user", text: "What if I raised slow assets to 55%?" },
  {
    role: "agent",
    text: "I ran it against the last 12 months on your current size.",
    table: [
      { label: "Yield", value: "7.9% → 8.4%" },
      { label: "Worst-case exit", value: "14 → 24 days", warn: true },
      { label: "Instant cash", value: "$9,600 → $5,800" },
    ],
    note: "Half a point more yield for ten more days of lock-up. Your call, not mine.",
    cta: "Open mandate builder",
  },
];

const FILTERS = ["all", "exec", "skip"];

export default function AgentPage() {
  const [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState(INITIAL_MESSAGES);

  // Illustrative last-activity time, ticking forward for real — "Active · 4
  // min ago" keeps counting up instead of sitting frozen at a fixed string.
  const [lastActiveAt] = useState(() => Date.now() - 4 * 60 * 1000);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);
  const activeLabel = `Active · ${formatRelativeTime(lastActiveAt, now)}`;

  const filteredDecisions = filter === "all" ? DECISIONS : DECISIONS.filter((d) => d.status === filter);

  const send = () => {
    if (!draft.trim()) return;
    setMessages((prev) => [...prev, { role: "user", text: draft.trim() }]);
    setDraft("");
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeadRow}>
        <div className={styles.pageHead}>
          <h1>Agent</h1>
          <p className={styles.lead} style={{ maxWidth: "none" }}>
            Running on the rails you signed.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className={styles.statusPill}>
            <IconCheckCircle size={14} />
            {activeLabel}
          </span>
          <button
            style={{
              font: "inherit",
              cursor: "pointer",
              fontSize: 12,
              background: "none",
              color: "var(--text-primary)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--radius)",
              padding: "5px 12px",
            }}
          >
            Pause
          </button>
        </div>
      </div>

      <div className={styles.statGrid}>
        {STAT_TILES.map((tile) => (
          <div className={styles.statTile} key={tile.key}>
            <div className={styles.statIcon} style={{ color: "var(--text-accent)" }}>
              {tile.icon}
            </div>
            <div className={styles.statBody}>
              <p className={styles.statLabel}>{tile.label}</p>
              <p className={styles.statValue} style={{ color: tile.success ? "var(--text-success)" : "var(--text-primary)" }}>
                {tile.value}
                {tile.suffix && <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 400 }}>{tile.suffix}</span>}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14, alignItems: "start" }}>
        <div className={styles.sideCol}>
          <div className={styles.panel}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <span className={styles.panelTitle} style={{ margin: 0 }}>Current stance</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Next cycle in 12 min</span>
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              {STANCE_TAGS.map((t) => (
                <span key={t} className={cx(styles.badge, styles.isNeutral)}>
                  {t}
                </span>
              ))}
            </div>
            <p className={styles.panelSub} style={{ marginBottom: 12 }}>
              Positioning is mildly stretched with no clear trend, so it holds about half in directional risk and
              half in carry.
            </p>
            <div className={styles.table}>
              <div className={styles.tableHead} style={{ minWidth: 0 }}>
                <span className={styles.colAsset} style={{ flex: 1.6 }}>Sleeve</span>
                <span className={styles.colNum}>Target</span>
                <span className={styles.colNum}>Actual</span>
                <span className={styles.colNum}>Value</span>
              </div>
              {SLEEVES.map((s) => (
                <div className={styles.tableRow} key={s.name} style={{ padding: "6px 0", minWidth: 0 }}>
                  <span className={styles.colAsset} style={{ flex: 1.6 }}>{s.name}</span>
                  <span className={cx(styles.colNum, styles.muted)}>{s.target}</span>
                  <span className={cx(styles.colNum, styles.figures)}>{s.actual}</span>
                  <span className={cx(styles.colNum, styles.figures, styles.muted)}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.panel}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
              <span className={styles.panelTitle} style={{ margin: 0 }}>Limits used</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Signed 6 days ago</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 13 }}>
              {LIMITS.map((l) => (
                <div key={l.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span>{l.label}</span>
                    <span className={cx(styles.muted, styles.figures)}>{l.display}</span>
                  </div>
                  <div className={styles.meter}>
                    <span className={styles.meterFill} style={{ width: `${(l.used / l.max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className={cx(styles.badge, styles.isAgent)} style={{ cursor: "pointer", border: "none", font: "inherit" }}>
                Edit mandate
              </button>
              <button className={styles.badge} style={{ cursor: "pointer", background: "none", font: "inherit" }}>
                Revoke
              </button>
            </div>
          </div>

          <div className={styles.panel}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
              <span className={styles.panelTitle} style={{ margin: 0 }}>Decision log</span>
              <span style={{ display: "flex", gap: 5 }}>
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    className={cx(styles.badge, filter === f && styles.isAgent)}
                    style={{ cursor: "pointer", background: filter === f ? undefined : "none", font: "inherit", textTransform: "capitalize" }}
                    onClick={() => setFilter(f)}
                  >
                    {f}
                  </button>
                ))}
              </span>
            </div>
            {filteredDecisions.map((d, i) => (
              <div
                key={i}
                style={{ display: "flex", gap: 11, padding: "9px 0", borderTop: "1px solid var(--border)", fontSize: 13, alignItems: "flex-start" }}
              >
                <span className={cx(styles.figures, styles.muted)} style={{ fontSize: 12, minWidth: 42, flexShrink: 0 }}>
                  {d.time}
                </span>
                <img className={styles.tokenLogo} src={d.logo} alt="" style={{ marginTop: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0 }}>{d.title}</p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "3px 0 0" }}>
                    {d.desc} <button className={styles.linkButton} style={{ fontSize: 12 }}>Ask why</button>
                  </p>
                </div>
                <span className={cx(styles.badge, d.status === "exec" ? styles.isSuccess : styles.isNeutral)}>{d.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={cx(styles.panel, styles.elevated)} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span className={styles.panelTitle} style={{ margin: 0 }}>Ask the agent</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Read-only</span>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {SUGGESTIONS.map((s) => (
              <button key={s} className={styles.suggestChip} onClick={() => setDraft(s)}>
                {s}
              </button>
            ))}
          </div>

          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className={cx(styles.chatBubbleRow, styles.isUser)}>
                <span className={styles.chatBubbleUser}>{m.text}</span>
              </div>
            ) : (
              <div key={i} className={styles.chatBubbleAgent}>
                {m.text && (
                  <p style={{ fontSize: 13, margin: m.table || m.cta ? "0 0 8px" : 0, lineHeight: 1.6 }}>{m.text}</p>
                )}
                {m.table &&
                  m.table.map((row) => (
                    <div className={styles.kvRow} key={row.label}>
                      <span className={styles.muted}>{row.label}</span>
                      <span className={styles.figures} style={{ color: row.warn ? "var(--text-warning)" : undefined }}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                {m.note && <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "10px 0", lineHeight: 1.5 }}>{m.note}</p>}
                {m.link && (
                  <button className={styles.linkButton} style={{ fontSize: 11 }}>
                    {m.link}
                  </button>
                )}
                {m.cta && (
                  <button className={cx(styles.badge, styles.isAgent)} style={{ marginTop: 4, cursor: "pointer", border: "none", font: "inherit" }}>
                    {m.cta}
                  </button>
                )}
              </div>
            )
          )}

          <div className={styles.chatInputRow}>
            <input
              className={styles.chatInput}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask about a decision, or say what you'll need"
              aria-label="Ask the agent"
            />
            <button className={styles.chatSendButton} onClick={send} aria-label="Send">
              <IconArrowUp />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
