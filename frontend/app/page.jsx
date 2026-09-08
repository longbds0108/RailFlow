"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Header from "../components/Header";
import { useMagnetic } from "../lib/useMagnetic";

const ACTIONS = [
  { label: "Swap", href: "/swap", desc: "Trade USDC, EURC, and cirBTC on Arc Testnet." },
  { label: "Bridge", href: "/bridge", desc: "Move USDC across Arc, Sepolia, and Base Sepolia via Circle CCTP." },
];

const SECURITY = [
  { title: "Self-custody", body: "Your keys stay in your wallet. RailFlow never holds them." },
  { title: "Visible actions", body: "Every call is shown before your signature, never after." },
  { title: "Explicit consent", body: "Nothing executes without your approval, every time." },
];

const SOCIALS = [
  {
    href: "https://x.com/Longlhu2Huu",
    label: "X (Twitter)",
    path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  },
  {
    href: "https://discord.com/",
    label: "Discord",
    path: "M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z",
  },
  {
    href: "https://t.me/lebry123",
    label: "Telegram",
    path: "M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z",
  },
];

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Fades + rises every [data-reveal] element the first time it scrolls into
// view. One observer for the whole page — cheaper than one per section.
function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll("[data-reveal]");
    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => observer.observe(el));
    // Safety net: force everything visible after a few seconds regardless —
    // content must never stay permanently hidden just because a browser
    // quirk kept the observer from firing (e.g. some automated renderers).
    const fallback = setTimeout(() => {
      els.forEach((el) => el.classList.add("is-visible"));
      observer.disconnect();
    }, 3000);
    return () => {
      observer.disconnect();
      clearTimeout(fallback);
    };
  }, []);
}

// A handful of twinkling dots behind the hero — generated client-side only
// (Math.random() during SSR would mismatch on hydration).
function Starfield({ count = 50 }) {
  const [stars, setStars] = useState([]);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    setStars(
      Array.from({ length: count }, () => ({
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: Math.random() < 0.8 ? 1 : 2,
        delay: `${Math.random() * 4}s`,
        duration: `${3 + Math.random() * 4}s`,
      }))
    );
  }, [count]);

  return (
    <div className="starfield" aria-hidden="true">
      {stars.map((s, i) => (
        <span
          key={i}
          className="star"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            animationDelay: s.delay,
            animationDuration: s.duration,
          }}
        />
      ))}
    </div>
  );
}

// Counts up from 0 to `target` once its own element scrolls into view.
function CountUp({ target, prefix = "", suffix = "", decimals = 0, duration = 1200 }) {
  const ref = useRef(null);
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      setValue(target);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || started.current) return;
        started.current = true;
        const start = performance.now();
        const tick = (now) => {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setValue(target * eased);
          if (progress < 1) requestAnimationFrame(tick);
          else setValue(target);
        };
        requestAnimationFrame(tick);
        observer.disconnect();
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

export default function HomePage() {
  useScrollReveal();
  const heroCta = useMagnetic();
  const finalCta = useMagnetic();

  return (
    <div className="app-shell">
      <Header />
      <main className="container">
        {/* Hero */}
        <section className="mkt-hero mkt-hero-solo">
          <Starfield />
          <div className="mkt-hero-copy">
            <p className="mkt-eyebrow">Arc Testnet · Self-custody</p>
            <h1>
              DeFi, above
              <br />
              the noise.
            </h1>
            <p className="lead">
              Swap and bridge USDC, EURC, and cirBTC on Arc Testnet. You sign every transaction
              yourself — nothing moves without your approval.
            </p>
            <div className="mkt-hero-cta">
              <Link
                ref={heroCta.ref}
                onMouseMove={heroCta.onMouseMove}
                onMouseLeave={heroCta.onMouseLeave}
                className="btn btn-primary magnetic"
                href="/dashboard"
              >
                Launch app →
              </Link>
            </div>
          </div>
        </section>

        <div className="mkt-body">
          {/* Protocol stats */}
          <section className="mkt-section">
            <dl className="mkt-stats-row" data-reveal>
              <div className="mkt-stat">
                <dd>—</dd>
                <dt>Protocol TVL</dt>
              </div>
              <div className="mkt-stat">
                <dd>—</dd>
                <dt>24h swap volume</dt>
              </div>
              <div className="mkt-stat">
                <dd>
                  <CountUp target={100} suffix="%" />
                </dd>
                <dt>Non-custodial</dt>
              </div>
            </dl>
            <p className="mkt-stats-footnote">Every action wallet-signed, on Arc Testnet.</p>
          </section>

          {/* What you can do */}
          <section id="defi" className="mkt-section">
            <div className="mkt-section-head" data-reveal>
              <p className="mkt-eyebrow">DeFi</p>
              <h2>Two ways to move.</h2>
              <p>Simple, self-custody paths — no lending, no leverage, nothing hidden.</p>
            </div>
            <div className="grid grid-cols-2" data-reveal>
              {ACTIONS.map((a) => (
                <Link key={a.label} href={a.href} className="feature-card">
                  <h3>{a.label}</h3>
                  <p>{a.desc}</p>
                </Link>
              ))}
            </div>
          </section>

          {/* Security */}
          <section id="security" className="mkt-section">
            <div className="mkt-section-head" data-reveal>
              <p className="mkt-eyebrow">Security</p>
              <h2>You hold the keys. Always.</h2>
              <p>RailFlow never custodies your funds — every transaction is built for your review and only moves once you sign it yourself.</p>
            </div>
            <div className="grid grid-cols-3" data-reveal>
              {SECURITY.map((s) => (
                <div key={s.title} className="card">
                  <h3>{s.title}</h3>
                  <p className="muted text-sm">{s.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Belief */}
          <section className="mkt-section">
            <p className="mkt-eyebrow" style={{ textAlign: "center", display: "block" }}>
              Our belief
            </p>
            <p className="mkt-quote" data-reveal>
              &ldquo;Onchain finance should reward good decisions — not familiarity with a dozen
              interfaces.&rdquo;
            </p>
          </section>

          {/* Final CTA */}
          <section className="mkt-final">
            <p className="mkt-eyebrow" style={{ textAlign: "center", display: "block" }}>
              Ready to move onchain?
            </p>
            <h2>Simple DeFi. Self-custody execution.</h2>
            <p>Swap and bridge on Arc Testnet — you sign every step yourself.</p>
            <Link
              ref={finalCta.ref}
              onMouseMove={finalCta.onMouseMove}
              onMouseLeave={finalCta.onMouseLeave}
              className="btn btn-primary magnetic"
              href="/dashboard"
            >
              Launch app →
            </Link>
          </section>
        </div>
      </main>

      <footer className="footer">
        <div className="container row-between">
          <span>© {new Date().getFullYear()} RailFlow — Arc Testnet demo</span>
          <div className="row" style={{ gap: "var(--space-3)" }}>
            {SOCIALS.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="social-link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d={s.path} />
                </svg>
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
