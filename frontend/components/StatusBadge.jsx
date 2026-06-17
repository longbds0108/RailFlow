import { statusKind } from "../lib/format";

export default function StatusBadge({ status }) {
  if (!status) return null;
  const kind = statusKind(status);
  const label = String(status).replace(/_/g, " ");
  return (
    <span className={`badge badge-dot badge-${kind}`} role="status">
      {label}
    </span>
  );
}
