// Logo registry for tokens and chains. Assets are self-hosted under public/logos
// so they render offline and avoid third-party CORS/availability issues.
const BASE = "/logos";

// Token symbol → logo path.
export const TOKEN_LOGOS = {
  USDC: `${BASE}/usdc.svg`,
  EURC: `${BASE}/eurc.png`,
  cirBTC: `${BASE}/cirbtc.svg`,
};

// App Kit chain name → logo path.
export const CHAIN_LOGOS = {
  Arc_Testnet: `${BASE}/arc-testnet.jpg`,
  Ethereum_Sepolia: `${BASE}/eth.svg`,
  Base_Sepolia: `${BASE}/base.png`,
};

// Brand mark used in the header wordmark / favicon (kept separate from the
// Arc Testnet chain logo so the site brand stays unchanged).
export const BRAND_LOGO = `${BASE}/arc.svg`;

export function tokenLogo(symbol) {
  return TOKEN_LOGOS[symbol] || null;
}

export function chainLogo(name) {
  return CHAIN_LOGOS[name] || null;
}
