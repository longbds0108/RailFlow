"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ENV } from "../lib/config";
import { BRAND_LOGO } from "../lib/logos";

const NAV = [
  { href: "/send", label: "Send" },
  { href: "/swap", label: "Swap" },
  { href: "/stake", label: "Stake" },
  { href: "/bridge", label: "Bridge" },
  { href: "/jobs", label: "Jobs" },
  { href: "/agent", label: "Assistant" },
  { href: "/history", label: "History" },
];

export default function Header() {
  const pathname = usePathname();

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
          <ConnectButton showBalance={false} chainStatus="icon" />
        </div>
      </div>
    </header>
  );
}
