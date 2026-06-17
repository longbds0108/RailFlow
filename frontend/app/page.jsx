import Link from "next/link";
import { TokenLogo, ChainLogo } from "../components/Logo";

const ASSETS = ["USDC", "EURC", "cirBTC"];
const NETWORKS = ["Arc_Testnet", "Ethereum_Sepolia", "Base_Sepolia"];

const FEATURES = [
  { href: "/send", title: "Send", desc: "Send USDC, EURC or cirBTC to any wallet address on Arc Testnet." },
  { href: "/swap", title: "Swap", desc: "Same-chain swaps between USDC, EURC and cirBTC via Circle App Kit." },
  { href: "/stake", title: "Stake", desc: "Stake USDC or EURC and earn USDC rewards at a fixed demo APY." },
  { href: "/bridge", title: "Bridge", desc: "Move USDC across chains with Circle CCTP (Arc · Sepolia · Base Sepolia)." },
  { href: "/history", title: "History", desc: "Review your own sends, swaps, stakes and bridges in one place." },
];

export default function HomePage() {
  return (
    <div>
      <section className="hero">
        <h1>
          Send stablecoins, swap, stake & bridge — on{" "}
          <span style={{ color: "var(--color-accent)" }}>Arc Testnet</span>.
        </h1>
        <p>
          ArcFlow is a self-custody demo built on Circle App Kit. You sign every
          transaction in MetaMask — the app never holds your keys.
        </p>
        <div className="row mt-5">
          <Link className="btn btn-primary" href="/send">
            Send tokens
          </Link>
          <Link className="btn btn-ghost" href="/swap">
            Swap tokens
          </Link>
        </div>

        <div className="row mt-5" style={{ gap: "var(--space-4)", flexWrap: "wrap" }}>
          <div className="row" style={{ gap: "var(--space-2)" }} aria-label="Supported tokens">
            {ASSETS.map((t) => (
              <span className="badge" key={t}>
                <TokenLogo symbol={t} size={16} />
                {t}
              </span>
            ))}
          </div>
          <div className="row" style={{ gap: "var(--space-2)" }} aria-label="Supported networks">
            {NETWORKS.map((n) => (
              <span className="badge" key={n}>
                <ChainLogo name={n} size={16} />
                {n.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3">
        {FEATURES.map((f) => (
          <Link key={f.href} href={f.href} className="feature-card">
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
