import { explorerTxUrl } from "../lib/config";

// Result panel shown after an action. Always includes an explorer link when a
// tx hash is present, plus an optional fallback note when no hash exists
// (App Kit fallback path).
export default function TxResult({ kind = "success", title, hash, children, note }) {
  const url = explorerTxUrl(hash);
  return (
    <div className={`notice notice-${kind} mt-4`} role="status" aria-live="polite">
      <div className="stack" style={{ gap: "var(--space-2)", flex: 1 }}>
        {title && <strong>{title}</strong>}
        {children}
        {hash && (
          <div className="text-sm">
            Transaction:{" "}
            <a href={url} target="_blank" rel="noopener noreferrer" className="mono">
              {hash.slice(0, 10)}…{hash.slice(-8)}
            </a>
          </div>
        )}
        {!hash && note && <div className="text-xs faint">{note}</div>}
      </div>
    </div>
  );
}
