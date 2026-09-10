"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import RailflowLogo from "./RailflowLogo";
import { BRIDGE_CHAINS } from "../lib/bridgeChains";

// Find our own logo/name for a connected chain id, so the header's network
// pill always shows a real logo (RainbowKit has no built-in icon for a
// brand-new chain like Arc Testnet).
function chainMetaFor(chainId) {
  return Object.values(BRIDGE_CHAINS).find((c) => c.chain.id === chainId) || null;
}

// Envelope design tokens — shared across every page under app/(app), so a
// single palette change here updates Lend, Swap, Yield, RWA, Bridge, Agent
// and Portfolio together. Values echo the marketing homepage's blue/ink
// palette (app/page.jsx) so the app feels continuous with railflow.co.
const ENVELOPE_TOKENS = {
  "--surface-1": "#ffffff",
  "--surface-2": "#f6f7fa",
  "--border": "#e3e6ee",
  "--border-strong": "#ccd3e3",
  "--radius": "8px",
  "--text-primary": "#171c2c",
  "--text-secondary": "#697080",
  "--text-muted": "#9aa1b0",
  "--text-accent": "#2045df",
  "--text-success": "#238563",
  "--bg-success": "#e6f4ee",
  "--text-danger": "#c23b3b",
  "--text-warning": "#a15c07",
  "--bg-warning": "#fdf2e0",
  "--bg-neutral": "#eef0f5",
  "--bg-accent": "#eaf0ff",
  "--fill-primary": "#2045df",
  "--fill-accent": "#2045df",
  "--on-primary": "#ffffff",
  "--font-mono": "ui-monospace, SFMono-Regular, Consolas, monospace",
};

const TABS = [
  { label: "Lend", href: "/lend" },
  { label: "Swap", href: "/swap" },
  { label: "Yield", href: "/yield" },
  { label: "RWA", href: "/rwa" },
  { label: "Bridge", href: "/bridge" },
  { label: "Agent", href: "/agent" },
  { label: "Portfolio", href: "/portfolio" },
];

export default function EnvelopeShell({ children }) {
  const pathname = usePathname();

  return (
    <div
      style={{
        ...ENVELOPE_TOKENS,
        background: "var(--surface-1)",
        minHeight: "100dvh",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: "var(--text-primary)",
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "var(--surface-1)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            maxWidth: 1440,
            margin: "0 auto",
            padding: "1.25rem 2rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <Link
            href="/lend"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 20,
              fontWeight: 500,
              color: "var(--text-primary)",
              textDecoration: "none",
            }}
          >
            <RailflowLogo size={28} />
            Railflow
          </Link>
          <span style={{ display: "flex", gap: 18, fontSize: 13, flexWrap: "wrap" }}>
            {TABS.map((tab) => {
              const active = pathname === tab.href || pathname?.startsWith(tab.href + "/");
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  style={{
                    color: active ? "var(--text-accent)" : "var(--text-secondary)",
                    textDecoration: "none",
                  }}
                >
                  {tab.label}
                </Link>
              );
            })}
          </span>
          <ConnectButton.Custom>
            {({ account, chain, openAccountModal, openChainModal, openConnectModal, authenticationStatus, mounted }) => {
              const ready = mounted && authenticationStatus !== "loading";
              const connected =
                ready && account && chain && (!authenticationStatus || authenticationStatus === "authenticated");

              return (
                <div
                  {...(!ready && {
                    "aria-hidden": true,
                    style: { opacity: 0, pointerEvents: "none", userSelect: "none" },
                  })}
                >
                  {(() => {
                    if (!connected) {
                      return (
                        <button
                          onClick={openConnectModal}
                          style={{
                            font: "inherit",
                            cursor: "pointer",
                            border: "none",
                            fontSize: 13,
                            fontWeight: 500,
                            background: "var(--fill-primary)",
                            color: "var(--on-primary)",
                            borderRadius: "var(--radius)",
                            padding: "8px 16px",
                          }}
                        >
                          Connect wallet
                        </button>
                      );
                    }

                    const meta = chainMetaFor(chain.id);

                    return (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          onClick={openChainModal}
                          style={{
                            font: "inherit",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 12,
                            fontWeight: 500,
                            background: "transparent",
                            color: chain.unsupported ? "var(--text-danger)" : "var(--text-primary)",
                            border: `0.5px solid ${chain.unsupported ? "var(--text-danger)" : "var(--border-strong)"}`,
                            borderRadius: "var(--radius)",
                            padding: "7px 11px",
                          }}
                        >
                          {!chain.unsupported && meta && (
                            <img src={meta.logo} alt="" width={16} height={16} style={{ borderRadius: "50%", flexShrink: 0 }} />
                          )}
                          {chain.unsupported ? "Wrong network" : meta ? meta.name : chain.name}
                        </button>
                        <button
                          onClick={openAccountModal}
                          style={{
                            font: "inherit",
                            cursor: "pointer",
                            fontSize: 12,
                            fontFamily: "var(--font-mono)",
                            background: "transparent",
                            color: "var(--text-primary)",
                            border: "0.5px solid var(--border-strong)",
                            borderRadius: "var(--radius)",
                            padding: "7px 11px",
                          }}
                        >
                          {account.displayName}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </header>

      <main
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: "2rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        {children}
      </main>
    </div>
  );
}
