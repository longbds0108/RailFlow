// ===========================================================================
// Circle App Kit wrapper for RailFlow (browser / self-custody).
//
// The user signs every transaction in MetaMask. We build a ViemAdapter over the
// wallet's EIP-1193 provider via createViemAdapterFromProvider (NOT the
// private-key adapter). All App Kit operations go through this module so the
// rest of the app does not import the SDK directly.
//
// Installed package API (verified against @circle-fin/app-kit@1.7.0 +
// @circle-fin/adapter-viem-v2@1.11.2):
//   - createViemAdapterFromProvider({ provider }) -> Promise<ViemAdapter>
//   - new AppKit()
//   - kit.send({ from:{adapter,chain}, to, amount, token })   -> BridgeStep (.txHash)
//   - kit.swap({ from:{adapter,chain}, tokenIn, tokenOut, amountIn, config }) -> SwapResult (.txHash,.amountOut)
//   - kit.bridge({ from:{adapter,chain}, to:{adapter,chain}, amount, token, config }) -> BridgeResult (.steps[].txHash,.state)
//   - kit.estimateSwap(...) -> SwapEstimate
//
// Adaptations vs SPEC snippet:
//   * createViemAdapterFromProvider is ASYNC (returns a Promise) — awaited here.
//   * Chain names are passed as App Kit strings "Arc_Testnet"/"Ethereum_Sepolia"/
//     "Base_Sepolia" (string form of the Blockchain enum) — kept per SPEC.
//   * Slippage is passed via config.slippageBps (SDK uses bps).
//
// GRACEFUL FALLBACK: if the SDK fails to load/instantiate at runtime, we throw a
// clearly-marked AppKitUnavailableError so callers can record the *intended*
// action to the backend without an on-chain hash. The build never depends on the
// SDK succeeding at runtime.
// ===========================================================================

import { ENV, APPKIT_CHAIN } from "./config";

export class AppKitUnavailableError extends Error {
  constructor(message) {
    super(message || "Circle App Kit is unavailable in this environment.");
    this.name = "AppKitUnavailableError";
    this.unavailable = true;
  }
}

let _kit = null;
let _adapter = null;
let _loadError = null;

// Circle App Kit calls api.circle.com / iris-api.circle.com directly from the
// browser, but those endpoints' CORS Access-Control-Allow-Headers omit the SDK's
// custom headers (X-License-Identifier, X-User-Agent) → the browser blocks them
// ("Failed to fetch"). We route Circle calls through our backend proxy
// (/api/cproxy) which forwards server-side (no CORS). Patched once, client-side.
const CIRCLE_HOST_RE = /^https:\/\/[a-z0-9.-]+\.circle\.com\//i;
function patchCircleFetch() {
  if (typeof window === "undefined" || window.__railflowCircleFetchPatched) return;
  const orig = window.fetch.bind(window);
  window.fetch = (input, init) => {
    try {
      const url = typeof input === "string" ? input : input?.url;
      if (url && CIRCLE_HOST_RE.test(url)) {
        const proxied = `${ENV.apiBase}/api/cproxy?url=${encodeURIComponent(url)}`;
        return typeof input === "string"
          ? orig(proxied, init)
          : orig(new Request(proxied, input), init);
      }
    } catch {
      /* fall through to original fetch */
    }
    return orig(input, init);
  };
  window.__railflowCircleFetchPatched = true;
}

function getProvider() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new AppKitUnavailableError("No EIP-1193 wallet provider (window.ethereum) found.");
  }
  return window.ethereum;
}

// Lazily load + instantiate the SDK (client-side only, dynamic import so the
// build / SSR never evaluates the SDK).
async function ensureKit() {
  if (_kit && _adapter) return { kit: _kit, adapter: _adapter };
  if (_loadError) throw _loadError;
  try {
    patchCircleFetch();
    const [{ AppKit }, { createViemAdapterFromProvider }] = await Promise.all([
      import("@circle-fin/app-kit"),
      import("@circle-fin/adapter-viem-v2"),
    ]);
    _kit = new AppKit();
    _adapter = await createViemAdapterFromProvider({ provider: getProvider() });
    return { kit: _kit, adapter: _adapter };
  } catch (err) {
    // TODO: if a future SDK version changes the factory/method signatures,
    // adapt the calls above. For now surface a clearly-marked fallback error.
    _loadError =
      err instanceof AppKitUnavailableError
        ? err
        : new AppKitUnavailableError(
            "Failed to initialize Circle App Kit: " + (err?.message || String(err))
          );
    throw _loadError;
  }
}

const kitConfig = () => ({ kitKey: ENV.kitKey });

// PAYMENT — send USDC to a receiver address (same chain, Arc Testnet).
export async function appkitSend({ to, amount, token = "USDC" }) {
  const { kit, adapter } = await ensureKit();
  const result = await kit.send({
    from: { adapter, chain: APPKIT_CHAIN.Arc_Testnet },
    to,
    amount,
    token,
    config: kitConfig(),
  });
  return { txHash: result?.txHash, raw: result };
}

// SWAP — same-chain swap on Arc Testnet.
export async function appkitSwap({ tokenIn, tokenOut, amountIn, slippageBps }) {
  const { kit, adapter } = await ensureKit();
  const result = await kit.swap({
    from: { adapter, chain: APPKIT_CHAIN.Arc_Testnet },
    tokenIn,
    tokenOut,
    amountIn,
    config: { ...kitConfig(), slippageBps },
  });
  return { txHash: result?.txHash, amountOut: result?.amountOut, raw: result };
}

// SWAP estimate (preview) — best-effort; returns null if not supported.
export async function appkitEstimateSwap({ tokenIn, tokenOut, amountIn, slippageBps }) {
  try {
    const { kit, adapter } = await ensureKit();
    if (typeof kit.estimateSwap !== "function") return null;
    const est = await kit.estimateSwap({
      from: { adapter, chain: APPKIT_CHAIN.Arc_Testnet },
      tokenIn,
      tokenOut,
      amountIn,
      config: { ...kitConfig(), slippageBps },
    });
    return est || null;
  } catch {
    return null;
  }
}

// BRIDGE — cross-chain USDC via CCTP.
export async function appkitBridge({ fromChain, toChain, amount, token = "USDC" }) {
  const { kit, adapter } = await ensureKit();
  const result = await kit.bridge({
    from: { adapter, chain: fromChain },
    to: { adapter, chain: toChain },
    amount,
    token,
    config: kitConfig(),
  });
  // Source tx hash = first step that produced a hash.
  const srcStep = (result?.steps || []).find((s) => s.txHash);
  return {
    srcTxHash: srcStep?.txHash,
    state: result?.state,
    steps: result?.steps || [],
    raw: result,
  };
}
