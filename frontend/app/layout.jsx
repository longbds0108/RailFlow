import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Providers from "../components/Providers";

// Dashboard display face (labels, stats, nav) — a CSS variable, not a
// default, so it never displaces the body's normal reading face.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata = {
  title: "RailFlow — Testnet dApp on Arc",
  description:
    "RailFlow is a self-custody testnet demo on Arc Testnet for USDC swaps and cross-chain bridging via Circle App Kit.",
  icons: {
    icon: "/logos/arc.svg",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0a14",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={plexMono.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
