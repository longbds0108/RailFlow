"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function Topbar() {
  return (
    <header className="dash-topbar">
      <div className="dash-topbar-icons">
        <button type="button" className="dash-icon-btn" aria-label="Search" disabled title="Coming soon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </button>
        <button type="button" className="dash-icon-btn" aria-label="Notifications" disabled title="Coming soon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 8a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 12 6 8Z" />
            <path d="M9.5 17a2.5 2.5 0 0 0 5 0" />
          </svg>
        </button>
      </div>
      <ConnectButton showBalance={false} chainStatus="full" />
    </header>
  );
}
