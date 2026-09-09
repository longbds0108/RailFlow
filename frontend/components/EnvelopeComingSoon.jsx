export default function EnvelopeComingSoon({ eyebrow, title, description, note, icon }) {
  return (
    <>
      <div>
        <span
          style={{
            display: "inline-block",
            fontSize: 11,
            background: "var(--bg-neutral)",
            color: "var(--text-secondary)",
            borderRadius: "var(--radius)",
            padding: "3px 9px",
            marginBottom: 8,
          }}
        >
          {eyebrow}
        </span>
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: "0 0 6px" }}>{title}</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6, maxWidth: 520 }}>
          {description}
        </p>
      </div>
      <div
        style={{
          background: "var(--surface-2)",
          border: "0.5px dashed var(--border-strong)",
          borderRadius: 12,
          padding: "2.75rem 1.125rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          textAlign: "center",
          color: "var(--text-secondary)",
          fontSize: 13,
        }}
      >
        {icon && (
          <div
            style={{
              width: 40,
              height: 40,
              display: "grid",
              placeItems: "center",
              background: "var(--surface-1)",
              color: "var(--text-accent)",
              borderRadius: "50%",
            }}
          >
            {icon}
          </div>
        )}
        {note}
      </div>
    </>
  );
}
