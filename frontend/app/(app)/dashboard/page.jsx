"use client";

import Link from "next/link";
import { useWallet, useBalances } from "../../../lib/useWallet";
import { TOKENS } from "../../../lib/config";
import { fmtAmount } from "../../../lib/format";
import { TokenLogo } from "../../../components/Logo";

const DONUT_COLORS = ["var(--color-primary)", "var(--color-accent)", "var(--color-warning)"];

function portfolioShare(balances) {
  const rows = Object.values(TOKENS)
    .filter((t) => t.address && t.displayBalance)
    .map((t) => {
      const raw = balances[t.symbol]?.raw || "0";
      const decimals = balances[t.symbol]?.decimals ?? t.decimals;
      const value = Number(fmtAmount(raw, decimals, 8).replace(/,/g, "")) || 0;
      return { symbol: t.symbol, raw, decimals, value };
    });
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  return { rows: rows.map((r) => ({ ...r, pct: total > 0 ? (r.value / total) * 100 : 0 })), total };
}

function Donut({ rows }) {
  const withShare = rows.filter((r) => r.pct > 0);
  if (withShare.length === 0) {
    return <div className="dash-donut dash-donut-empty" aria-hidden="true" />;
  }
  let acc = 0;
  const stops = withShare.map((r, i) => {
    const start = acc;
    acc += r.pct;
    return `${DONUT_COLORS[i % DONUT_COLORS.length]} ${start}% ${acc}%`;
  });
  return (
    <div
      className="dash-donut"
      style={{ background: `conic-gradient(${stops.join(", ")})` }}
      role="img"
      aria-label="Portfolio breakdown by token"
    />
  );
}

function PortfolioCard() {
  const { address, correctNetwork } = useWallet();
  const { balances, loading } = useBalances(correctNetwork ? address : null);
  const ready = address && correctNetwork;
  const { rows, total } = portfolioShare(balances);

  return (
    <article className="dash-card">
      <div className="dash-card-head">
        <div>
          <p className="dash-card-eyebrow">Portfolio</p>
          <h3>Testnet balances</h3>
        </div>
        <span className="dash-card-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16v6H4zM4 14h10v6H4zM17 14h3v6h-3z" />
          </svg>
        </span>
      </div>

      {!ready ? (
        <div className="dash-placeholder">
          <p>Connect your wallet on Arc Testnet to see your USDC, EURC, and cirBTC balances.</p>
        </div>
      ) : (
        <div className="dash-portfolio-body">
          <Donut rows={rows} />
          <ul className="dash-asset-list">
            {rows.map((r, i) => (
              <li key={r.symbol} className="dash-asset-row">
                <span className="dash-asset-dot" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} aria-hidden="true" />
                <TokenLogo symbol={r.symbol} size={18} />
                <span className="dash-asset-symbol">{r.symbol}</span>
                <span className="dash-asset-amount">
                  {loading ? <span className="skeleton" style={{ width: 56, display: "inline-block" }} /> : fmtAmount(r.raw, r.decimals)}
                </span>
                <span className="dash-asset-pct">{total > 0 ? `${r.pct.toFixed(0)}%` : "—"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function AssistantCard() {
  return (
    <article className="dash-card">
      <div className="dash-card-head">
        <div>
          <p className="dash-card-eyebrow">AI Assistant</p>
          <h3>Trading assistant</h3>
        </div>
        <span className="dash-card-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4Z" />
            <path d="M5 20a7 7 0 0 1 14 0" />
          </svg>
        </span>
      </div>
      <div className="dash-placeholder dash-placeholder-tall">
        <span className="badge badge-warning">Coming soon</span>
        <p>
          An assistant that reads your real balances and proposes Swap or Bridge transactions for
          you to review and sign yourself. RailFlow never trades or signs on your behalf.
        </p>
      </div>
    </article>
  );
}

function SwapCard() {
  return (
    <article className="dash-card">
      <div className="dash-card-head">
        <div>
          <p className="dash-card-eyebrow">DeFi</p>
          <h3>Swap</h3>
        </div>
        <span className="dash-card-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 7h11l-3-3M17 17H6l3 3M7 7v10M17 17V7" />
          </svg>
        </span>
      </div>
      <div className="dash-card-body">
        <p className="muted text-sm">Trade USDC, EURC, and cirBTC on Arc Testnet. You sign every swap yourself.</p>
        <div className="dash-token-row" aria-hidden="true">
          {Object.values(TOKENS).map((t) => (
            <TokenLogo key={t.symbol} symbol={t.symbol} size={22} />
          ))}
        </div>
        <Link href="/swap" className="btn btn-primary btn-block">
          Open Swap →
        </Link>
      </div>
    </article>
  );
}

function BridgeCard() {
  return (
    <article className="dash-card">
      <div className="dash-card-head">
        <div>
          <p className="dash-card-eyebrow">Cross-chain</p>
          <h3>Bridge</h3>
        </div>
        <span className="dash-card-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 15v-3a5 5 0 0 1 10 0v3M3 15h4M9 15h4M13 15h4M17 15h4M3 15v3M21 15v3" />
          </svg>
        </span>
      </div>
      <div className="dash-card-body">
        <p className="muted text-sm">Move USDC across Arc Testnet, Ethereum Sepolia, and Base Sepolia via Circle CCTP.</p>
        <div className="dash-chain-row">
          <span className="badge badge-info">Arc</span>
          <span aria-hidden="true">→</span>
          <span className="badge badge-info">Sepolia</span>
          <span aria-hidden="true">→</span>
          <span className="badge badge-info">Base Sepolia</span>
        </div>
        <Link href="/bridge" className="btn btn-primary btn-block">
          Open Bridge →
        </Link>
      </div>
    </article>
  );
}

export default function HomePage() {
  return (
    <div className="dash-home">
      <div className="dash-home-head">
        <div>
          <p className="dash-card-eyebrow">Arc Testnet · Self-custody</p>
          <h1>Welcome back.</h1>
        </div>
      </div>
      <div className="dash-grid">
        <AssistantCard />
        <PortfolioCard />
        <SwapCard />
        <BridgeCard />
      </div>
    </div>
  );
}
