"use client";

import { useCallback, useEffect, useState } from "react";
import { useConfig as useWagmiConfig } from "wagmi";
import { readContract, switchChain, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { parseUnits } from "viem";
import { erc20Abi, erc20ApproveAbi } from "./erc20";
import {
  BYTES32_ZERO,
  FINALITY_THRESHOLD_STANDARD,
  MAX_FEE_STANDARD,
  MESSAGE_TRANSMITTER_V2,
  TOKEN_MESSENGER_V2,
  addressToBytes32,
  messageTransmitterV2Abi,
  tokenMessengerV2Abi,
  waitForAttestation,
} from "./cctp";
import { BRIDGE_CHAINS, BRIDGE_CHAIN_KEYS } from "./bridgeChains";

const readAbi = [...erc20Abi, ...erc20ApproveAbi];

// Real USDC balance for `address` on every bridge-supported chain, read
// directly against each chain's own RPC (via wagmiConfig's transports) —
// no wallet network switch needed just to display balances.
export function useMultiChainUsdcBalance(address, refreshKey = 0) {
  const config = useWagmiConfig();
  const [balances, setBalances] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setBalances({});
      return;
    }
    let active = true;
    setLoading(true);
    Promise.all(
      BRIDGE_CHAIN_KEYS.map(async (key) => {
        const c = BRIDGE_CHAINS[key];
        try {
          const bal = await readContract(config, {
            address: c.usdc,
            abi: readAbi,
            functionName: "balanceOf",
            args: [address],
            chainId: c.chain.id,
          });
          return [key, bal];
        } catch {
          return [key, null];
        }
      })
    ).then((entries) => {
      if (!active) return;
      setBalances(Object.fromEntries(entries));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [address, config, refreshKey]);

  return { balances, loading };
}

// Steps, in order, of a real CCTP V2 "Standard Transfer": switch the wallet
// to the source chain, approve USDC to TokenMessengerV2 if needed, burn via
// depositForBurn, wait for Circle's Iris attestation, switch the wallet to
// the destination chain, then mint via MessageTransmitterV2#receiveMessage.
export const BRIDGE_STEPS = ["switch-source", "approve", "burn", "attest", "switch-dest", "mint", "done"];

export function useBridgeFlow() {
  const config = useWagmiConfig();
  const [step, setStep] = useState("idle");
  const [error, setError] = useState(null);
  const [burnTxHash, setBurnTxHash] = useState(null);
  const [mintTxHash, setMintTxHash] = useState(null);

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
    setBurnTxHash(null);
    setMintTxHash(null);
  }, []);

  const run = useCallback(
    async ({ fromKey, toKey, amount, recipient }) => {
      const from = BRIDGE_CHAINS[fromKey];
      const to = BRIDGE_CHAINS[toKey];
      setError(null);
      setMintTxHash(null);

      try {
        // If a previous attempt already burned (e.g. attestation or mint
        // failed and the user hit retry), reuse that burn instead of
        // depositing again — CCTP has no way to "undo" a burn.
        let burnHash = burnTxHash;

        if (!burnHash) {
          const amountRaw = parseUnits(amount, 6);

          setStep("switch-source");
          await switchChain(config, { chainId: from.chain.id });

          setStep("approve");
          const allowance = await readContract(config, {
            address: from.usdc,
            abi: readAbi,
            functionName: "allowance",
            args: [recipient, TOKEN_MESSENGER_V2],
            chainId: from.chain.id,
          });
          if (allowance < amountRaw) {
            const approveHash = await writeContract(config, {
              address: from.usdc,
              abi: readAbi,
              functionName: "approve",
              args: [TOKEN_MESSENGER_V2, amountRaw],
              chainId: from.chain.id,
            });
            await waitForTransactionReceipt(config, { hash: approveHash, chainId: from.chain.id });
          }

          setStep("burn");
          burnHash = await writeContract(config, {
            address: TOKEN_MESSENGER_V2,
            abi: tokenMessengerV2Abi,
            functionName: "depositForBurn",
            args: [amountRaw, to.domain, addressToBytes32(recipient), from.usdc, BYTES32_ZERO, MAX_FEE_STANDARD, FINALITY_THRESHOLD_STANDARD],
            chainId: from.chain.id,
          });
          setBurnTxHash(burnHash);
          await waitForTransactionReceipt(config, { hash: burnHash, chainId: from.chain.id });
        }

        setStep("attest");
        const attestation = await waitForAttestation(from.domain, burnHash);

        setStep("switch-dest");
        await switchChain(config, { chainId: to.chain.id });

        setStep("mint");
        const mintHash = await writeContract(config, {
          address: MESSAGE_TRANSMITTER_V2,
          abi: messageTransmitterV2Abi,
          functionName: "receiveMessage",
          args: [attestation.message, attestation.attestation],
          chainId: to.chain.id,
        });
        setMintTxHash(mintHash);
        await waitForTransactionReceipt(config, { hash: mintHash, chainId: to.chain.id });

        setStep("done");
      } catch (e) {
        // Leave `step` where it failed (rather than a separate "error" step)
        // so the tracker can show exactly which step didn't complete.
        setError(e.shortMessage || e.message || "Bridge failed");
      }
    },
    [config, burnTxHash]
  );

  return { step, error, burnTxHash, mintTxHash, run, reset };
}
