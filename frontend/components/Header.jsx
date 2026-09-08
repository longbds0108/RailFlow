"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ENV } from "../lib/config";
import { BRAND_LOGO } from "../lib/logos";
import { useMagnetic } from "../lib/useMagnetic";

const NAV = [
  { href: "/swap", label: "Swap" },
  { href: "/bridge", label: "Bridge" },
  { href: "/dashboard", label: "Dashboard" },
];

const HOME_NAV = [
  { href: "#defi", label: "DeFi" },
  { href: "#security", label: "Security" },
];

export default function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [isScrolled, setIsScrolled] = useState(false);
  const launchCta = useMagnetic();

  useEffect(() => {
    if (!isHome) return;
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  return (
    <header className={`header ${isHome ? `header-transparent ${isScrolled ? "is-scrolled" : ""}` : ""}`}>
      <div className="container header-inner">
        <Link href="/" className="wordmark" aria-label={`${ENV.appName} home`}>
          <img className="mark" src={BRAND_LOGO} alt="" aria-hidden="true" />
          <span className="arc">Rail</span>
          <span className="flow">Flow</span>
        </Link>

        {isHome ? (
          <nav className="nav nav-center" aria-label="Section">
            <span className="nav-pill">
              {HOME_NAV.map((item) => (
                <a key={item.href} href={item.href}>
                  {item.label}
                </a>
              ))}
            </span>
          </nav>
        ) : (
          <nav className="nav" aria-label="Primary">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}

        {isHome ? (
          <Link
            ref={launchCta.ref}
            onMouseMove={launchCta.onMouseMove}
            onMouseLeave={launchCta.onMouseLeave}
            href="/dashboard"
            className="btn btn-primary magnetic"
          >
            Launch app →
          </Link>
        ) : (
          <ConnectButton showBalance={false} chainStatus="icon" />
        )}
      </div>
    </header>
  );
}
