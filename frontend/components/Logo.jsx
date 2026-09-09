import { tokenLogo, chainLogo } from "../lib/logos";

// Generic round logo image. Renders nothing if no src is known.
export function Logo({ src, alt = "", size = 18, className = "", style }) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`logo ${className}`.trim()}
      style={{ width: size, height: size, ...style }}
      loading="lazy"
      decoding="async"
    />
  );
}

// Token logo by symbol (USDC / EURC / cirBTC).
export function TokenLogo({ symbol, size = 18, className = "", style }) {
  return (
    <Logo src={tokenLogo(symbol)} alt={symbol} size={size} className={className} style={style} />
  );
}

// Chain logo by App Kit chain name (Arc_Testnet / Ethereum_Sepolia / Base_Sepolia).
export function ChainLogo({ name, size = 18, className = "", style }) {
  return <Logo src={chainLogo(name)} alt={name} size={size} className={className} style={style} />;
}
