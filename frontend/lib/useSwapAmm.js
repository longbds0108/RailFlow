"use client";

import { useCallback, useEffect, useState } from "react";
import { useConfig as useWagmiConfig } from "wagmi";
import { getPublicClient } from "wagmi/actions";
import { ENV, TOKENS } from "./config";
import { erc20Abi, erc20ApproveAbi } from "./erc20";
import { AMM_ADDRESS, AMM_DEPLOYED_BLOCK, railflowAmmAbi, ammSwap } from "./ammSwap";

const readAbi = [...erc20Abi, ...erc20ApproveAbi];
const SYMBOLS = ["USDC", "EURC", "cirBTC"];

// Real wallet balance + pool allowance for all 3 swap tokens, so the Swap
// page never has to guess or fall back to a placeholder balance.
export function useSwapBalances(address, refreshKey = 0) {
  const wagmiCfg = useWagmiConfig();
  const [balances, setBalances] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!AMM_ADDRESS || !address) {
      setBalances({});
      return;
    }
    let active = true;
    setLoading(true);
    const client = getPublicClient(wagmiCfg, { chainId: ENV.chainId });

    Promise.all(
      SYMBOLS.map(async (symbol) => {
        const token = TOKENS[symbol];
        const [balance, allowance] = await Promise.all([
          client.readContract({ address: token.address, abi: readAbi, functionName: "balanceOf", args: [address] }),
          client.readContract({ address: token.address, abi: readAbi, functionName: "allowance", args: [address, AMM_ADDRESS] }),
        ]);
        return [symbol, { balance, allowance, decimals: token.decimals, address: token.address }];
      })
    ).then((entries) => {
      if (!active) return;
      setBalances(Object.fromEntries(entries));
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [address, wagmiCfg, refreshKey]);

  return { balances, loading };
}

// Real on-chain quote + reserves for one ordered pair (tokenIn -> tokenOut).
// `reserveIn/reserveOut` being 0 means this pair genuinely has no seeded
// liquidity yet — the page should say so rather than show a rate.
export function useSwapQuote(fromSymbol, toSymbol, amountIn, refreshKey = 0) {
  const wagmiCfg = useWagmiConfig();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!AMM_ADDRESS || fromSymbol === toSymbol) {
      setQuote(null);
      return;
    }
    const inMeta = TOKENS[fromSymbol];
    const outMeta = TOKENS[toSymbol];
    let active = true;
    setLoading(true);
    const client = getPublicClient(wagmiCfg, { chainId: ENV.chainId });
    const pool = { address: AMM_ADDRESS, abi: railflowAmmAbi };

    const amt = (() => {
      try {
        const n = Number(amountIn);
        if (!amountIn || !(n > 0)) return 0n;
        return BigInt(Math.round(n * 10 ** inMeta.decimals));
      } catch {
        return 0n;
      }
    })();

    Promise.all([
      client.readContract({ ...pool, functionName: "getReserves", args: [inMeta.address, outMeta.address] }),
      amt > 0n ? client.readContract({ ...pool, functionName: "getAmountOut", args: [inMeta.address, outMeta.address, amt] }) : Promise.resolve(0n),
    ])
      .then(([[reserveIn, reserveOut], amountOut]) => {
        if (!active) return;
        setQuote({ reserveIn, reserveOut, amountOut, hasLiquidity: reserveIn > 0n && reserveOut > 0n });
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setQuote(null);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fromSymbol, toSymbol, amountIn, wagmiCfg, refreshKey]);

  return { quote, loading };
}

// Executes a real swap (approve if needed, then swap()) via the shared
// ammSwap() helper, exposing pending/error state for the UI.
export function useExecuteSwap() {
  const [status, setStatus] = useState("idle"); // idle | approving | swapping | done | error
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setTxHash(null);
  }, []);

  const execute = useCallback(async ({ address, tokenIn, tokenOut, amountIn, slippageBps = 100 }) => {
    setError(null);
    setStatus("swapping");
    try {
      const result = await ammSwap({
        address,
        tokenIn,
        tokenOut,
        amountIn,
        slippageBps,
        poolAddress: AMM_ADDRESS,
        tokens: TOKENS,
        onStatus: setStatus,
      });
      setTxHash(result.txHash);
      setStatus("done");
      return result;
    } catch (e) {
      setError(e.shortMessage || e.message || "Swap failed");
      setStatus("error");
      return null;
    }
  }, []);

  return { execute, status, error, txHash, reset, isBusy: status === "approving" || status === "swapping" };
}

// Real swap history for one wallet, read straight from the AMM's own Swap
// events — no separate database, and no session-only limitation either
// (unlike Bridge's log, this persists across visits since it's on-chain).
export function useSwapHistory(address, refreshKey = 0) {
  const wagmiCfg = useWagmiConfig();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!AMM_ADDRESS || !address) {
      setEntries([]);
      return;
    }
    let active = true;
    setLoading(true);
    const client = getPublicClient(wagmiCfg, { chainId: ENV.chainId });
    const bySymbol = Object.fromEntries(SYMBOLS.map((s) => [TOKENS[s].address.toLowerCase(), s]));

    client
      .getContractEvents({
        address: AMM_ADDRESS,
        abi: railflowAmmAbi,
        eventName: "Swap",
        args: { user: address },
        fromBlock: AMM_DEPLOYED_BLOCK,
        toBlock: "latest",
      })
      .then(async (logs) => {
        const withTimestamps = await Promise.all(
          logs.map(async (log) => {
            const block = await client.getBlock({ blockNumber: log.blockNumber });
            const fromSym = bySymbol[log.args.tokenIn.toLowerCase()];
            const toSym = bySymbol[log.args.tokenOut.toLowerCase()];
            return {
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
              timestamp: Number(block.timestamp) * 1000,
              fromSymbol: fromSym,
              toSymbol: toSym,
              amountIn: log.args.amountIn,
              amountOut: log.args.amountOut,
            };
          })
        );
        if (!active) return;
        withTimestamps.sort((a, b) => b.blockNumber - a.blockNumber);
        setEntries(withTimestamps);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [address, wagmiCfg, refreshKey]);

  return { entries, loading };
}
