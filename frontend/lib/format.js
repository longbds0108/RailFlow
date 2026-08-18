import { formatUnits } from "viem";

export function shortAddr(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// Fixed locale (not the runtime default) everywhere numbers/dates are
// formatted: the server pre-renders with Node's locale while the browser
// hydrates with its own (e.g. Vietnamese, "2,5" vs "2.5"), and that mismatch
// breaks React hydration. en-US keeps server and client output identical.
const LOCALE = "en-US";

export function fmtAmount(raw, decimals, maxFrac = 4) {
  try {
    const v = formatUnits(BigInt(raw), decimals);
    const n = Number(v);
    if (Number.isNaN(n)) return v;
    return n.toLocaleString(LOCALE, { maximumFractionDigits: maxFrac });
  } catch {
    return "0";
  }
}

export function fmtNumber(n, maxFrac = 4) {
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  return num.toLocaleString(LOCALE, { maximumFractionDigits: maxFrac });
}

export function bpsToPct(bps) {
  return (Number(bps) / 100).toLocaleString(LOCALE, { maximumFractionDigits: 2 }) + "%";
}

export function apyFromBps(bps) {
  return (Number(bps) / 100).toLocaleString(LOCALE, { maximumFractionDigits: 2 }) + "%";
}

export function fmtDate(ts) {
  if (!ts) return "—";
  const d = typeof ts === "number" ? new Date(ts) : new Date(String(ts));
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleString(LOCALE);
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
  funded: "info",
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
  open: "warning",
  submitted: "warning",
  claimed: "warning",
  created: "success",
  // bad
  failed: "danger",
  expired: "danger",
  cancelled: "danger",
  rejected: "danger",
};

export function statusKind(status) {
  return STATUS_KIND[status] || "info";
}
