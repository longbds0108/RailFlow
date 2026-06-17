"use client";

import { useConfig } from "./ConfigProvider";

export default function DisclaimerBanner() {
  const { config } = useConfig();
  const text = config?.disclaimer?.en;
  if (!text) return null;
  return (
    <div className="disclaimer" role="note" aria-label="Testnet disclaimer">
      <div className="container">
        <strong>Testnet demo:</strong>
        <span>{text}</span>
      </div>
    </div>
  );
}
