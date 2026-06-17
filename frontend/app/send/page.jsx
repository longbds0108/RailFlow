"use client";

import { useCallback, useEffect, useState } from "react";
import { parseUnits, formatUnits, isAddress } from "viem";
import { useConfig as useWagmiConfig } from "wagmi";
import { getPublicClient, getWalletClient } from "wagmi/actions";
import { useWallet } from "../../lib/useWallet";
import WalletGate from "../../components/WalletGate";
import Balances from "../../components/Balances";
import TxResult from "../../components/TxResult";
import { api } from "../../lib/api";
import { erc20TransferAbi } from "../../lib/erc20";
import { TOKENS, ENV } from "../../lib/config";
import { TokenLogo } from "../../components/Logo";

const SEND_TOKENS = ["USDC", "EURC", "cirBTC"];

export default function SendPage() {
  return (
    <div>
      <h1 className="page-title">Send</h1>
      <p className="page-subtitle">
        Send USDC, EURC or cirBTC to any wallet address on Arc Testnet. You sign in
        MetaMask — the recipient receives the full amount.
      </p>
      <div className="row row-between" style={{ marginBottom: "var(--space-4)" }}>
        <span className="muted text-sm">Your balances</span>
        <Balances />
      </div>
      <WalletGate>
        <SendForm />
      </WalletGate>
    </div>
  );
}

function SendForm() {
  const wagmiCfg = useWagmiConfig();
  const { address } = useWallet();

  const [recipient, setRecipient] = useState("");
  const [token, setToken] = useState("USDC");
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState(null); // estimated gas fee in native USDC (string) | null
  const [feeLoading, setFeeLoading] = useState(false);
  const [phase, setPhase] = useState("form"); // form | signing | recording | done | error
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const tokenMeta = TOKENS[token];
  const recipientValid = isAddress(recipient);
  const amountValid = amount && Number(amount) > 0;
  const valid = recipientValid && amountValid;

  // Live gas-fee estimate (gas token on Arc is USDC). Recompute on input changes.
  const estimateFee = useCallback(async () => {
    if (!valid || !address || !tokenMeta?.address) {
      setFee(null);
      return;
    }
    setFeeLoading(true);
    try {
      const pc = getPublicClient(wagmiCfg, { chainId: ENV.chainId });
      const units = parseUnits(amount, tokenMeta.decimals);
      const [gas, gasPrice] = await Promise.all([
        pc.estimateContractGas({
          account: address,
          address: tokenMeta.address,
          abi: erc20TransferAbi,
          functionName: "transfer",
          args: [recipient, units],
        }),
        pc.getGasPrice(),
      ]);
      // Arc native gas token = USDC (18 decimals).
      setFee(formatUnits(gas * gasPrice, 18));
    } catch {
      setFee(null); // estimation needs balance/valid state; show a fallback label
    } finally {
      setFeeLoading(false);
    }
  }, [valid, address, tokenMeta, amount, recipient, wagmiCfg]);

  useEffect(() => {
    const t = setTimeout(estimateFee, 400); // debounce typing
    return () => clearTimeout(t);
  }, [estimateFee]);

  const send = async () => {
    setError(null);
    setPhase("signing");
    try {
      const walletClient = await getWalletClient(wagmiCfg, { chainId: ENV.chainId });
      const publicClient = getPublicClient(wagmiCfg, { chainId: ENV.chainId });
      const units = parseUnits(amount, tokenMeta.decimals);

      const txHash = await walletClient.writeContract({
        address: tokenMeta.address,
        abi: erc20TransferAbi,
        functionName: "transfer",
        args: [recipient, units],
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      setPhase("recording");
      let record = null;
      try {
        record = await api.recordSend({ address, to: recipient, token, amount, txHash });
      } catch {
        record = { status: "success" };
      }
      setResult({ txHash, status: record?.status || "success" });
      setPhase("done");
    } catch (e) {
      setError(e.shortMessage || e.message);
      setPhase("error");
    }
  };

  const reset = () => {
    setPhase("form");
    setError(null);
    setResult(null);
    setAmount("");
    setRecipient("");
    setFee(null);
  };

  const sending = phase === "signing" || phase === "recording";
  const feeLabel = feeLoading
    ? "estimating…"
    : fee != null
      ? `${Number(fee).toFixed(6)} USDC`
      : valid
        ? "—"
        : "enter details";

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      {/* 1. Recipient address */}
      <div className="field">
        <label htmlFor="recipient">Recipient address</label>
        <input
          id="recipient"
          className="input mono"
          type="text"
          spellCheck={false}
          autoComplete="off"
          placeholder="0x… wallet address"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value.trim())}
          disabled={phase !== "form"}
          aria-invalid={recipient.length > 0 && !recipientValid}
        />
        {recipient.length > 0 && !recipientValid && (
          <span className="text-xs" style={{ color: "var(--color-danger)" }}>
            Enter a valid 0x wallet address.
          </span>
        )}
      </div>

      {/* 2. Amount to send + token */}
      <div className="field">
        <label htmlFor="amount">Amount to send</label>
        <div className="row" style={{ gap: "var(--space-2)", flexWrap: "nowrap" }}>
          <input
            id="amount"
            className="input"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={phase !== "form"}
            style={{ flex: 1 }}
          />
          <div className="select-wrap" style={{ width: "auto", flex: "0 0 auto" }}>
            <TokenLogo symbol={token} size={18} className="select-logo" />
            <select
              aria-label="Token"
              className="select"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={phase !== "form"}
              style={{ width: "auto" }}
            >
              {SEND_TOKENS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. Send fee + receive value */}
      <div
        className="card"
        style={{ background: "var(--color-bg-elev)", padding: "var(--space-4)" }}
      >
        <div className="kv">
          <dt>Send fee (network gas)</dt>
          <dd>{feeLabel}</dd>
        </div>
        <div className="kv">
          <dt>Receive value</dt>
          <dd className="row" style={{ gap: "var(--space-1)", justifyContent: "flex-end" }}>
            <TokenLogo symbol={token} size={16} />
            {amountValid ? `${amount} ${token}` : `— ${token}`}
          </dd>
        </div>
      </div>

      {/* 4. Send assets */}
      {phase !== "done" && (
        <button
          className="btn btn-primary btn-block mt-4"
          onClick={send}
          disabled={!valid || sending}
        >
          {sending && <span className="spinner" aria-hidden="true" />}
          {phase === "signing"
            ? "Confirm in MetaMask…"
            : phase === "recording"
              ? "Recording…"
              : "Send assets"}
        </button>
      )}

      {error && phase === "error" && (
        <div className="notice notice-danger mt-4" role="alert">
          {error}
        </div>
      )}

      {phase === "done" && result && (
        <TxResult
          kind={result.status === "success" ? "success" : "danger"}
          title={result.status === "success" ? "Assets sent" : "Send not completed"}
          hash={result.txHash}
        >
          <div className="text-sm">
            Sent {amount} {token} to <span className="mono">{recipient.slice(0, 8)}…{recipient.slice(-6)}</span>
          </div>
          <button className="btn btn-ghost btn-sm mt-3" onClick={reset}>
            Send more
          </button>
        </TxResult>
      )}
    </div>
  );
}
