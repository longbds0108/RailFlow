import Link from "next/link";
import { TokenLogo, ChainLogo } from "../components/Logo";

const ASSETS = ["USDC", "EURC", "cirBTC"];
const NETWORKS = ["Arc_Testnet", "Ethereum_Sepolia", "Base_Sepolia"];

const BADGES = [
  ...ASSETS.map((key) => ({ kind: "token", key })),
  ...NETWORKS.map((key) => ({ kind: "chain", key })),
];

function Badge({ kind, badgeKey, hidden }) {
  const label = kind === "token" ? badgeKey : badgeKey.replace(/_/g, " ");
  return (
    <span className="badge" aria-hidden={hidden || undefined}>
      {kind === "token" ? (
        <TokenLogo symbol={badgeKey} size={16} />
      ) : (
        <ChainLogo name={badgeKey} size={16} />
      )}
      {label}
    </span>
  );
}

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
          RailFlow is a self-custody demo built on Circle App Kit. You sign every
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

        <div className="badge-ticker mt-5" aria-label="Supported tokens and networks">
          <div className="badge-ticker-track">
            {BADGES.map((b) => (
              <Badge key={b.key} kind={b.kind} badgeKey={b.key} />
            ))}
            {BADGES.map((b) => (
              <Badge key={`${b.key}-dup`} kind={b.kind} badgeKey={b.key} hidden />
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
