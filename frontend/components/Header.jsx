"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "../lib/useWallet";
import { shortAddr } from "../lib/format";
import { ENV } from "../lib/config";
import { BRAND_LOGO } from "../lib/logos";
import { ChainLogo } from "./Logo";

const NAV = [
  { href: "/send", label: "Send" },
  { href: "/swap", label: "Swap" },
  { href: "/stake", label: "Stake" },
  { href: "/bridge", label: "Bridge" },
  { href: "/history", label: "History" },
];

export default function Header() {
  const pathname = usePathname();
  const {
    status,
    address,
    isConnected,
    correctNetwork,
    connectMetaMask,
    isConnecting,
    disconnect,
    switchToArc,
  } = useWallet();

  return (
    <header className="header">
      <div className="container header-inner">
        <Link href="/" className="wordmark" aria-label={`${ENV.appName} home`}>
          <img className="mark" src={BRAND_LOGO} alt="" aria-hidden="true" />
          <span className="arc">Rail</span>
          <span className="flow">Flow</span>
        </Link>

        <nav className="nav" aria-label="Primary">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="row" style={{ gap: "var(--space-2)" }}>
          {isConnected && (
            <span
              className={`badge ${correctNetwork ? "badge-success" : "badge-warning"}`}
              title={correctNetwork ? "Connected to Arc Testnet" : "Wrong network"}
            >
              {correctNetwork ? (
                <ChainLogo name="Arc_Testnet" size={14} />
              ) : null}
              {correctNetwork ? "Arc Testnet" : "Wrong network"}
            </span>
          )}

          {!isConnected ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={connectMetaMask}
              disabled={isConnecting || status === "no-wallet"}
            >
              {isConnecting && <span className="spinner" aria-hidden="true" />}
              {status === "no-wallet"
                ? "Install MetaMask"
                : isConnecting
                  ? "Connecting…"
                  : "Connect"}
            </button>
          ) : !correctNetwork ? (
            <>
              <button className="btn btn-primary btn-sm" onClick={switchToArc}>
                Switch network
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => disconnect()}
                aria-label="Disconnect wallet"
              >
                Disconnect
              </button>
            </>
          ) : (
            <>
              <span className="badge mono" title={address}>
                {shortAddr(address)}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => disconnect()}
                aria-label="Disconnect wallet"
              >
                Disconnect
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
