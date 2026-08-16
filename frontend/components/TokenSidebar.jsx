"use client";

import { useWallet, useBalances } from "../lib/useWallet";
import { fmtAmount } from "../lib/format";
import { TokenLogo } from "./Logo";

const ALL_TOKENS = ["USDC", "EURC", "cirBTC"];

// Real-world names — descriptive labels, not app data.
const TOKEN_FULL_NAMES = { USDC: "USD Coin", EURC: "Euro Coin", cirBTC: "Circle BTC" };

// Shared sidebar for Send/Swap/Bridge: token list with the connected wallet's
// real balance per token, plus a faucet pointer. Renders "…" per row until
// balances resolve rather than a placeholder amount.
export default function TokenSidebar() {
  const { address } = useWallet();
  const { balances } = useBalances(address);

  return (
    <div className="stack">
      <div className="card">
        <h3 style={{ fontSize: "var(--text-base)", marginBottom: "var(--space-3)" }}>Tokens</h3>
        <div className="stack" style={{ gap: "var(--space-3)" }}>
          {ALL_TOKENS.map((t) => (
            <div key={t} className="row row-between">
              <div className="row" style={{ gap: "var(--space-2)" }}>
                <TokenLogo symbol={t} size={28} />
                <div>
                  <div style={{ fontWeight: 700 }}>{t}</div>
                  <div className="muted text-xs">{TOKEN_FULL_NAMES[t]}</div>
                </div>
              </div>
              <span className="mono text-sm" style={{ fontWeight: 700 }}>
                {balances[t] ? fmtAmount(balances[t].raw, balances[t].decimals) : "…"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="muted text-sm" style={{ marginBottom: "var(--space-2)" }}>
          Need testnet tokens?
        </div>
        <p className="text-sm" style={{ marginBottom: "var(--space-3)" }}>
          Get free USDC and EURC from the Circle Faucet.
        </p>
        <a
          href="https://faucet.circle.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontWeight: 700 }}
        >
          faucet.circle.com ↗
        </a>
      </div>
    </div>
  );
}
