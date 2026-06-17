import { formatUnits } from "viem";

export function shortAddr(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function fmtAmount(raw, decimals, maxFrac = 4) {
  try {
    const v = formatUnits(BigInt(raw), decimals);
    const n = Number(v);
    if (Number.isNaN(n)) return v;
    return n.toLocaleString(undefined, { maximumFractionDigits: maxFrac });
  } catch {
    return "0";
  }
}

export function fmtNumber(n, maxFrac = 4) {
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  return num.toLocaleString(undefined, { maximumFractionDigits: maxFrac });
}

export function bpsToPct(bps) {
  return (Number(bps) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) + "%";
}

export function apyFromBps(bps) {
  return (Number(bps) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) + "%";
}

export function fmtDate(ts) {
  if (!ts) return "—";
  const d = typeof ts === "number" ? new Date(ts) : new Date(String(ts));
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleString();
}

const STATUS_KIND = {
  // success-ish
  paid: "success",
  success: "success",
  completed: "success",
  active: "success",
  claimable: "info",
  source_confirmed: "info",
  destination_processing: "info",
  // pending-ish
  pending: "warning",
  processing: "warning",
  draft: "warning",
  waiting_approval: "warning",
  waiting_signature: "warning",
  waiting_bridge: "warning",
  pending_source: "warning",
  unstaking: "warning",
  no_stake: "warning",
  // bad
  failed: "danger",
  expired: "danger",
  cancelled: "danger",
};

export function statusKind(status) {
  return STATUS_KIND[status] || "info";
}
