"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "../../lib/useWallet";
import WalletGate from "../../components/WalletGate";
import StatusBadge from "../../components/StatusBadge";
import { api } from "../../lib/api";
import { explorerTxUrl } from "../../lib/config";
import { fmtDate } from "../../lib/format";

export default function HistoryPage() {
  return (
    <div>
      <h1 className="page-title">History</h1>
      <p className="page-subtitle">
        Your payments, swaps, stakes and bridges on Arc Testnet, newest first.
      </p>
      <WalletGate>
        <HistoryList />
      </WalletGate>
    </div>
  );
}

function TxLink({ hash }) {
  if (!hash || hash === "0x") return <span className="faint">—</span>;
  return (
    <a href={explorerTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="mono">
      {hash.slice(0, 8)}…{hash.slice(-6)}
    </a>
  );
}

function HistoryList() {
  const { address } = useWallet();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    if (!address) return;
    setLoading(true);
    setError(null);
    api
      .getHistory(address)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [address]);

  useEffect(() => {
    load();
  }, [load]);

  // Normalize: backend may return a unified array or grouped object.
  const normalize = (res) => {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res.items)) return res.items;
    const groups = ["payments", "swaps", "stakes", "bridges"];
    const out = [];
    for (const g of groups) {
      if (Array.isArray(res[g])) {
        for (const item of res[g]) {
          out.push({ kind: g.slice(0, -1), ...item });
        }
      }
    }
    return out.sort((a, b) => {
      const ta = new Date(a.createdAt || a.created_at || 0).getTime();
      const tb = new Date(b.createdAt || b.created_at || 0).getTime();
      return tb - ta;
    });
  };

  const rows = normalize(data);

  if (loading) {
    return (
      <div className="card stack">
        {[0, 1, 2, 3].map((i) => (
          <div className="skeleton" key={i} style={{ height: 20 }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="notice notice-danger" role="alert">
          Could not load history: {error}
        </div>
        <button className="btn btn-ghost btn-sm mt-3" onClick={load}>
          Retry
        </button>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="card center">
        <h3>No activity yet</h3>
        <p className="muted">
          Make a payment, swap, stake or bridge and it will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Detail</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Tx</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const kind = r.kind || r.type || "—";
            const hash = r.txHash || r.tx_hash || r.srcTxHash || r.src_tx_hash;
            const detail =
              (r.tokenIn && `${r.tokenIn} → ${r.tokenOut}`) ||
              (r.fromChain && `${r.fromChain} → ${r.toChain}`) ||
              (r.action && `${r.action} ${r.token || ""}`) ||
              (r.recipient && `${r.token} → ${r.recipient.slice(0, 6)}…${r.recipient.slice(-4)}`) ||
              r.token ||
              "—";
            const amount = r.amount ?? r.amountIn ?? "—";
            return (
              <tr key={r.id || i}>
                <td style={{ textTransform: "capitalize" }}>{kind}</td>
                <td>{detail}</td>
                <td className="mono">{amount}</td>
                <td>
                  <StatusBadge status={r.status} />
                </td>
                <td>
                  <TxLink hash={hash} />
                </td>
                <td className="faint">{fmtDate(r.createdAt || r.created_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
