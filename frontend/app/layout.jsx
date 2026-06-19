import "./globals.css";
import Providers from "../components/Providers";
import Header from "../components/Header";
import { ENV } from "../lib/config";

export const metadata = {
  title: "RailFlow — Testnet dApp on Arc",
  description:
    "RailFlow is a self-custody testnet demo on Arc Testnet for USDC payments, swaps, staking and cross-chain bridging via Circle App Kit.",
  icons: {
    icon: "/logos/arc.svg",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0f1a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="ambient" aria-hidden="true">
          <span className="ambient-orb ambient-orb-1" />
          <span className="ambient-orb ambient-orb-2" />
          <span className="ambient-orb ambient-orb-3" />
        </div>
        <Providers>
          <div className="app-shell">
            <Header />
            <main className="container">{children}</main>
            <footer className="footer">
              <div className="container row row-between">
                <span>
                  {ENV.appName} · Self-custody testnet demo on Arc Testnet (Circle).
                </span>
                <a
                  href="https://faucet.circle.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Get testnet tokens →
                </a>
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
