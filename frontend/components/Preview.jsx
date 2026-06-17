// Reusable preview shown before signing: a key/value list + testnet warning.
export default function Preview({ title = "Review before signing", rows = [], children }) {
  return (
    <div className="card mt-4" style={{ background: "var(--color-bg-elev)" }}>
      <h3 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-3)" }}>{title}</h3>
      <dl style={{ margin: 0 }}>
        {rows.map((r) => (
          <div className="kv" key={r.label}>
            <dt>{r.label}</dt>
            <dd className={r.mono ? "mono" : undefined}>{r.value}</dd>
          </div>
        ))}
      </dl>
      {children}
    </div>
  );
}
