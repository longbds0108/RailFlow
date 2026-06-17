"use client";

import { useCallback, useEffect, useState } from "react";
import { parseUnits } from "viem";
import { useConfig as useWagmiConfig } from "wagmi";
import { getPublicClient, getWalletClient } from "wagmi/actions";
import { useConfig } from "../../components/ConfigProvider";
import { useWallet } from "../../lib/useWallet";
import WalletGate from "../../components/WalletGate";
import Balances from "../../components/Balances";
import Preview from "../../components/Preview";
import TxResult from "../../components/TxResult";
import { api } from "../../lib/api";
import { arcStakingAbi, erc20ApproveAbi } from "../../lib/erc20";
import { TOKENS, ENV } from "../../lib/config";
import { TokenLogo } from "../../components/Logo";
import { fmtAmount, apyFromBps } from "../../lib/format";

export default function StakePage() {
  return (
    <div>
      <h1 className="page-title">Stake</h1>
      <p className="page-subtitle">
        Stake USDC or EURC into the ArcStaking contract and earn USDC rewards at a fixed
        demo APY.
      </p>
      <div className="row row-between" style={{ marginBottom: "var(--space-4)" }}>
        <span className="muted text-sm">Your balances</span>
        <Balances />
      </div>
      <WalletGate>
        <StakeModule />
      </WalletGate>
    </div>
  );
}

function StakeModule() {
  const { config } = useConfig();
  const wagmiCfg = useWagmiConfig();
  const { address } = useWallet();
  const stakingAddress = config?.stakingAddress;
  const staking = config?.staking || {};
  const stakable = staking.stakableTokens || ["USDC", "EURC"];

  const [token, setToken] = useState(stakable[0] || "USDC");
  const [action, setAction] = useState("stake"); // stake | unstake | claim
  const [amount, setAmount] = useState("");
  const [info, setInfo] = useState(null); // { staked, pending }
  const [refreshKey, setRefreshKey] = useState(0);
  const [phase, setPhase] = useState("form"); // form | preview | approving | signing | recording | done | error
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const tokenMeta = TOKENS[token];

  const loadInfo = useCallback(async () => {
    if (!stakingAddress || !address || !tokenMeta?.address) return;
    try {
      const client = getPublicClient(wagmiCfg, { chainId: ENV.chainId });
      const [stakeInfo, pending] = await Promise.all([
        client.readContract({
          address: stakingAddress,
          abi: arcStakingAbi,
          functionName: "stakeInfo",
          args: [address, tokenMeta.address],
        }),
        client.readContract({
          address: stakingAddress,
          abi: arcStakingAbi,
          functionName: "pendingReward",
          args: [address, tokenMeta.address],
        }),
      ]);
      const stakedRaw = Array.isArray(stakeInfo) ? stakeInfo[0] : stakeInfo?.amount;
      setInfo({ staked: (stakedRaw ?? 0n).toString(), pending: (pending ?? 0n).toString() });
    } catch (e) {
      setInfo({ staked: "0", pending: "0", error: e.message });
    }
  }, [stakingAddress, address, tokenMeta, wagmiCfg]);

  useEffect(() => {
    loadInfo();
  }, [loadInfo, refreshKey]);

  if (stakingAddress === null || stakingAddress === undefined) {
    return (
      <div className="card">
        <h3>Staking contract not deployed yet</h3>
        <p className="muted">
          The ArcStaking contract has not been deployed to Arc Testnet. Once the deploy
          script writes its address to <span className="mono">config/deployed.json</span>,
          staking will become available here.
        </p>
        <div className="kv mt-3">
          <dt>Reward token</dt>
          <dd>{staking.rewardToken || "USDC"}</dd>
        </div>
        <div className="kv">
          <dt>APY</dt>
          <dd>{apyFromBps(staking.apyBps ?? 1000)}</dd>
        </div>
      </div>
    );
  }

  const valid = action === "claim" || (amount && Number(amount) > 0);

  const confirm = async () => {
    setError(null);
    try {
      const walletClient = await getWalletClient(wagmiCfg, { chainId: ENV.chainId });
      const publicClient = getPublicClient(wagmiCfg, { chainId: ENV.chainId });
      const decimals = tokenMeta.decimals;
      const amt = action === "claim" ? 0n : parseUnits(amount || "0", decimals);

      // Approve allowance before stake if needed.
      if (action === "stake") {
        const allowance = await publicClient.readContract({
          address: tokenMeta.address,
          abi: erc20ApproveAbi,
          functionName: "allowance",
          args: [address, stakingAddress],
        });
        if (allowance < amt) {
          setPhase("approving");
          const approveHash = await walletClient.writeContract({
            address: tokenMeta.address,
            abi: erc20ApproveAbi,
            functionName: "approve",
            args: [stakingAddress, amt],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }
      }

      setPhase("signing");
      const fnArgs =
        action === "claim" ? [tokenMeta.address] : [tokenMeta.address, amt];
      const txHash = await walletClient.writeContract({
        address: stakingAddress,
        abi: arcStakingAbi,
        functionName: action,
        args: fnArgs,
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      setPhase("recording");
      let record = null;
      try {
        record = await api.recordStake({
          address,
          action,
          token,
          amount: action === "claim" ? "0" : amount,
          txHash,
        });
      } catch {
        record = { status: "success" };
      }
      setResult({ txHash, status: record?.status || "success" });
      setPhase("done");
      setRefreshKey((k) => k + 1);
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
  };

  return (
    <div className="grid grid-cols-3" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
      <div className="card">
        <div className="field">
          <label htmlFor="stakeToken">Token</label>
          <div className="select-wrap">
            <TokenLogo symbol={token} size={18} className="select-logo" />
            <select
              id="stakeToken"
              className="select"
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                reset();
              }}
              disabled={phase !== "form"}
            >
              {stakable.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="stakeAction">Action</label>
          <select
            id="stakeAction"
            className="select"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              reset();
            }}
            disabled={phase !== "form"}
          >
            <option value="stake">Stake</option>
            <option value="unstake">Unstake</option>
            <option value="claim">Claim rewards</option>
          </select>
        </div>

        {action !== "claim" && (
          <div className="field">
            <label htmlFor="stakeAmount">Amount ({token})</label>
            <input
              id="stakeAmount"
              className="input"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={phase !== "form"}
            />
            {action === "stake" && staking.minStake && (
              <span className="text-xs faint">Minimum stake: {staking.minStake} {token}</span>
            )}
          </div>
        )}

        {phase === "form" && (
          <button
            className="btn btn-primary btn-block mt-3"
            onClick={() => setPhase("preview")}
            disabled={!valid}
          >
            Review {action}
          </button>
        )}

        {phase !== "form" && phase !== "done" && (
          <Preview
            title={`Review ${action}`}
            rows={[
              { label: "Action", value: action },
              { label: "Token", value: token },
              ...(action !== "claim"
                ? [{ label: "Amount", value: `${amount} ${token}` }]
                : [
                    {
                      label: "Claimable reward",
                      value: `${fmtAmount(info?.pending || "0", TOKENS[staking.rewardToken || "USDC"].decimals)} ${staking.rewardToken || "USDC"}`,
                    },
                  ]),
              { label: "APY", value: apyFromBps(staking.apyBps ?? 1000) },
              { label: "Network", value: "Arc Testnet" },
              { label: "Contract", value: stakingAddress, mono: true },
            ]}
          >
            <div className="row mt-4">
              <button
                className="btn btn-primary"
                onClick={confirm}
                disabled={["approving", "signing", "recording"].includes(phase)}
              >
                {["approving", "signing", "recording"].includes(phase) && (
                  <span className="spinner" aria-hidden="true" />
                )}
                {phase === "approving"
                  ? "Approving allowance…"
                  : phase === "signing"
                    ? "Confirm in MetaMask…"
                    : phase === "recording"
                      ? "Recording…"
                      : `Confirm ${action}`}
              </button>
              <button
                className="btn btn-ghost"
                onClick={reset}
                disabled={["approving", "signing", "recording"].includes(phase)}
              >
                Cancel
              </button>
            </div>
          </Preview>
        )}

        {error && phase === "error" && (
          <div className="notice notice-danger mt-4" role="alert">
            {error}
          </div>
        )}

        {phase === "done" && result && (
          <TxResult kind="success" title={`${action} confirmed`} hash={result.txHash}>
            <div className="text-sm">
              <span className="badge badge-success">{result.status}</span>
            </div>
            <button className="btn btn-ghost btn-sm mt-3" onClick={reset}>
              Done
            </button>
          </TxResult>
        )}
      </div>

      <div className="card" style={{ background: "var(--color-bg-elev)" }}>
        <h3 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-3)" }}>
          Your position
        </h3>
        <div className="kv">
          <dt>Staked ({token})</dt>
          <dd>{info ? fmtAmount(info.staked, tokenMeta.decimals) : "…"}</dd>
        </div>
        <div className="kv">
          <dt>Pending reward</dt>
          <dd>
            {info
              ? `${fmtAmount(info.pending, TOKENS[staking.rewardToken || "USDC"].decimals)} ${staking.rewardToken || "USDC"}`
              : "…"}
          </dd>
        </div>
        <div className="kv">
          <dt>APY</dt>
          <dd>{apyFromBps(staking.apyBps ?? 1000)}</dd>
        </div>
        <div className="kv">
          <dt>Lock</dt>
          <dd>{(staking.lockSeconds ?? 0) === 0 ? "None" : `${staking.lockSeconds}s`}</dd>
        </div>
        <button
          className="btn btn-ghost btn-sm btn-block mt-3"
          onClick={() => setRefreshKey((k) => k + 1)}
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
