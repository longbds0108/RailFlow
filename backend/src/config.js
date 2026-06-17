// Loads shared chain/token config + runtime env. Never exposes secrets.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");

// Secrets live at repo root .env (one level above backend/).
dotenv.config({ path: resolve(repoRoot, ".env") });

const arcConfigPath = resolve(repoRoot, "config", "arc.json");
const deployedPath = resolve(repoRoot, "config", "deployed.json");

export const arc = JSON.parse(readFileSync(arcConfigPath, "utf8"));

/** Read deployed staking address; null if config/deployed.json is absent or empty. */
export function getStakingAddress() {
  try {
    if (!existsSync(deployedPath)) return null;
    const deployed = JSON.parse(readFileSync(deployedPath, "utf8"));
    return deployed?.staking ?? null;
  } catch {
    return null;
  }
}

/** Safe subset of arc.json for the public /api/config endpoint. */
export function publicConfig() {
  return {
    network: arc.network,
    appKitChainName: arc.appKitChainName,
    tokens: arc.tokens,
    packages: arc.payment.packages,
    payment: {
      receiver: arc.payment.receiver,
      token: arc.payment.token,
      orderTimeoutMinutes: arc.payment.orderTimeoutMinutes,
    },
    staking: arc.staking,
    swap: arc.swap,
    bridge: arc.bridge,
    disclaimer: arc.disclaimer,
    stakingAddress: getStakingAddress(),
  };
}

export const env = {
  port: Number(process.env.PORT || 4000),
  databasePath: resolve(__dirname, "..", process.env.DATABASE_PATH || "./data/arcflow.sqlite"),
  paymentReceiver: (process.env.PAYMENT_RECEIVER_ADDRESS || arc.payment.receiver).toLowerCase(),
  // Comma-separated list of allowed CORS origins (e.g. "https://arcflow.click,http://localhost:3000").
  frontendOrigin: (process.env.FRONTEND_ORIGIN || "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
};

export const chain = {
  id: arc.network.chainId,
  rpcUrl: arc.network.rpcUrl,
  usdcAddress: arc.tokens.USDC.address.toLowerCase(),
  usdcDecimals: arc.tokens.USDC.decimals,
  orderTimeoutMinutes: arc.payment.orderTimeoutMinutes,
};
