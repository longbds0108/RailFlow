// One-time setup: generate + register a Circle Entity Secret for Developer-
// Controlled Wallets. Run this ONCE per Circle API key — Circle allows only
// one entity secret registration per key, so re-running after one is already
// set will refuse rather than silently overwrite it. Writes
// CIRCLE_ENTITY_SECRET into the root .env and saves the recovery file Circle
// returns (required for account recovery — Circle keeps no copy, so back it
// up somewhere safe outside this repo, e.g. a password manager).
//
// Usage: cd backend && node scripts/setupEntitySecret.js
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { registerEntitySecretCiphertext } from "@circle-fin/developer-controlled-wallets";
import { env } from "../src/config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const ENV_PATH = resolve(repoRoot, ".env");
const RECOVERY_DIR = resolve(__dirname, "..", "circle-recovery");

async function main() {
  if (!env.circleApiKey) {
    throw new Error("Missing CIRCLE_API_KEY in .env — add it first.");
  }
  if (env.circleEntitySecret) {
    throw new Error(
      "CIRCLE_ENTITY_SECRET is already set in .env. Circle allows only one entity " +
        "secret registration per API key — re-running would fail or orphan the " +
        "existing one. Remove it from .env manually first if you're sure you want a new one."
    );
  }

  const entitySecret = randomBytes(32).toString("hex");
  console.log("Generated a new entity secret (32 random bytes).");

  console.log("Registering with Circle...");
  const response = await registerEntitySecretCiphertext({
    apiKey: env.circleApiKey,
    entitySecret,
  });

  const recoveryFile = response.data?.recoveryFile;
  if (!recoveryFile) {
    throw new Error("Circle did not return a recovery file — registration may have failed.");
  }

  mkdirSync(RECOVERY_DIR, { recursive: true });
  const recoveryPath = resolve(RECOVERY_DIR, `recovery_${Date.now()}.dat`);
  writeFileSync(recoveryPath, recoveryFile);
  console.log(`Recovery file saved to ${recoveryPath}`);
  console.log(
    "IMPORTANT: back this file up somewhere safe OUTSIDE this repo (password manager, secure storage) — Circle keeps no copy."
  );

  const envText = readFileSync(ENV_PATH, "utf8");
  const updated = /^CIRCLE_ENTITY_SECRET=.*$/m.test(envText)
    ? envText.replace(/^CIRCLE_ENTITY_SECRET=.*$/m, `CIRCLE_ENTITY_SECRET=${entitySecret}`)
    : envText + `CIRCLE_ENTITY_SECRET=${entitySecret}\n`;
  writeFileSync(ENV_PATH, updated);
  console.log("Wrote CIRCLE_ENTITY_SECRET to .env");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
