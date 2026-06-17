"use client";

import { useWallet, useBalances } from "../lib/useWallet";
import { fmtAmount } from "../lib/format";
import { TOKENS } from "../lib/config";
import { TokenLogo } from "./Logo";

// Shows balances for every token with a known address (USDC, EURC, cirBTC).
export default function Balances({ refreshKey = 0 }) {
  const { address, correctNetwork } = useWallet();
  const { balances, loading } = useBalances(correctNetwork ? address : null, refreshKey);

  if (!address || !correctNetwork) return null;

  const shown = Object.values(TOKENS).filter((t) => t.address && t.displayBalance);

  return (
    <div className="row" style={{ gap: "var(--space-2)" }} aria-label="Token balances">
      {shown.map((t) => (
        <span className="badge badge-info" key={t.symbol}>
          <TokenLogo symbol={t.symbol} size={16} />
          {loading ? (
            <span className="skeleton" style={{ width: 48, display: "inline-block" }} />
          ) : (
            <>
              {fmtAmount(balances[t.symbol]?.raw || "0", balances[t.symbol]?.decimals ?? t.decimals)}{" "}
              {t.symbol}
            </>
          )}
        </span>
      ))}
    </div>
  );
}
