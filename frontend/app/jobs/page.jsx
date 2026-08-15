"use client";

import { useCallback, useEffect, useState } from "react";
import { decodeEventLog, isAddress, keccak256, parseUnits, toHex } from "viem";
import { useConfig as useWagmiConfig } from "wagmi";
import { getPublicClient, getWalletClient } from "wagmi/actions";
import { useConfig } from "../../components/ConfigProvider";
import { useWallet } from "../../lib/useWallet";
import WalletGate from "../../components/WalletGate";
import Balances from "../../components/Balances";
import TxResult from "../../components/TxResult";
import StatusBadge from "../../components/StatusBadge";
import { api } from "../../lib/api";
import { agenticCommerceAbi, JOB_STATUS_NAMES, ZERO_ADDRESS } from "../../lib/jobsAbi";
import { erc20ApproveAbi } from "../../lib/erc20";
import { TOKENS, ENV, explorerAddressUrl } from "../../lib/config";
import { shortAddr, fmtAmount } from "../../lib/format";

export default function JobsPage() {
  return (
    <div>
      <h1 className="page-title">Jobs</h1>
      <p className="page-subtitle">
        ERC-8183 job escrow demo on Arc Testnet: create a job as client, fund it, then
        walk through the provider and evaluator roles — same self-custody pattern as
        every other module here, you sign each step yourself in MetaMask.
      </p>
      <div className="row row-between" style={{ marginBottom: "var(--space-4)" }}>
        <span className="muted text-sm">Your balances</span>
        <Balances />
      </div>
      <WalletGate>
        <JobsModule />
      </WalletGate>
    </div>
  );
}

function JobsModule() {
  const { config } = useConfig();
  const wagmiCfg = useWagmiConfig();
  const { address } = useWallet();
  const contract = config?.jobs?.agenticCommerceContract;
  const defaultExpirySeconds = config?.jobs?.defaultExpirySeconds ?? 3600;

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadJobs = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      setJobs(await api.getJobs(address));
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs, refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  if (!contract) {
    return (
      <div className="card">
        <h3>Loading job contract config…</h3>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3" style={{ gridTemplateColumns: "1fr 1.4fr" }}>
      <CreateJobCard
        contract={contract}
        defaultExpirySeconds={defaultExpirySeconds}
        address={address}
        wagmiCfg={wagmiCfg}
        onCreated={refresh}
      />

      <div>
        <div className="row row-between" style={{ marginBottom: "var(--space-3)" }}>
          <h3 style={{ margin: 0 }}>Your jobs</h3>
          <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={loading}>
            Refresh
          </button>
        </div>
        {jobs.length === 0 && (
          <p className="muted text-sm">No jobs yet — create one to get started.</p>
        )}
        <div className="stack" style={{ gap: "var(--space-3)" }}>
          {jobs.map((j) => (
            <JobCard
              key={j.jobId}
              job={j}
              contract={contract}
              address={address}
              wagmiCfg={wagmiCfg}
              onChanged={refresh}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CreateJobCard({ contract, defaultExpirySeconds, address, wagmiCfg, onCreated }) {
  const [description, setDescription] = useState("");
  const [provider, setProvider] = useState("");
  const [evaluator, setEvaluator] = useState("");
  const [phase, setPhase] = useState("form"); // form | signing | recording | done | error
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!address) return;
    setProvider((p) => p || address);
    setEvaluator((e) => e || address);
  }, [address]);

  const valid = description.trim().length > 0 && isAddress(provider) && isAddress(evaluator);

  const create = async () => {
    setError(null);
    setPhase("signing");
    try {
      const walletClient = await getWalletClient(wagmiCfg, { chainId: ENV.chainId });
      const publicClient = getPublicClient(wagmiCfg, { chainId: ENV.chainId });
      const block = await publicClient.getBlock();
      const expiredAt = block.timestamp + BigInt(defaultExpirySeconds);

      const txHash = await walletClient.writeContract({
        address: contract,
        abi: agenticCommerceAbi,
        functionName: "createJob",
        args: [provider, evaluator, expiredAt, description.trim(), ZERO_ADDRESS],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      let jobId = null;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== contract.toLowerCase()) continue;
        try {
          const decoded = decodeEventLog({
            abi: agenticCommerceAbi,
            data: log.data,
            topics: log.topics,
            eventName: "JobCreated",
          });
          jobId = decoded.args.jobId.toString();
          break;
        } catch {
          /* not the JobCreated log — skip */
        }
      }
      if (!jobId) throw new Error("Could not read the new job id back from the transaction.");

      setPhase("recording");
      await api.syncJob(jobId).catch(() => null);
      setResult({ jobId, txHash });
      setPhase("done");
      onCreated();
    } catch (e) {
      setError(e.shortMessage || e.message);
      setPhase("error");
    }
  };

  const reset = () => {
    setPhase("form");
    setError(null);
    setResult(null);
    setDescription("");
  };

  const busy = phase === "signing" || phase === "recording";

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Create a job</h3>
      <p className="muted text-sm">
        You&apos;re the client. Provider and evaluator default to your own address so you
        can walk the whole lifecycle solo — edit them to test with a second wallet.
      </p>

      {phase !== "done" && (
        <>
          <div className="field">
            <label htmlFor="jobDescription">Description</label>
            <input
              id="jobDescription"
              className="input"
              placeholder="e.g. Write a summary of the RailFlow docs"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={phase !== "form"}
            />
          </div>
          <div className="field">
            <label htmlFor="jobProvider">Provider address</label>
            <input
              id="jobProvider"
              className="input mono"
              value={provider}
              onChange={(e) => setProvider(e.target.value.trim())}
              disabled={phase !== "form"}
            />
          </div>
          <div className="field">
            <label htmlFor="jobEvaluator">Evaluator address</label>
            <input
              id="jobEvaluator"
              className="input mono"
              value={evaluator}
              onChange={(e) => setEvaluator(e.target.value.trim())}
              disabled={phase !== "form"}
            />
            <span className="text-xs faint">
              Expires in {Math.round(defaultExpirySeconds / 60)} minutes. Budget is set by
              the provider after creation.
            </span>
          </div>

          <button className="btn btn-primary btn-block mt-3" onClick={create} disabled={!valid || busy}>
            {busy && <span className="spinner" aria-hidden="true" />}
            {phase === "signing" ? "Confirm in MetaMask…" : phase === "recording" ? "Recording…" : "Create job"}
          </button>

          {error && phase === "error" && (
            <div className="notice notice-danger mt-3" role="alert">
              {error}
            </div>
          )}
        </>
      )}

      {phase === "done" && result && (
        <TxResult kind="success" title={`Job #${result.jobId} created`} hash={result.txHash}>
          <div className="text-sm">Find it under &quot;Your jobs&quot; to continue the lifecycle.</div>
          <button className="btn btn-ghost btn-sm mt-3" onClick={reset}>
            Create another
          </button>
        </TxResult>
      )}
    </div>
  );
}

function JobCard({ job, contract, address, wagmiCfg, onChanged }) {
  const [live, setLive] = useState(null);
  const [phase, setPhase] = useState("idle"); // idle | signing | recording | error
  const [error, setError] = useState(null);
  const [amount, setAmount] = useState("");
  const [deliverableText, setDeliverableText] = useState("");

  const loadLive = useCallback(async () => {
    try {
      const publicClient = getPublicClient(wagmiCfg, { chainId: ENV.chainId });
      const j = await publicClient.readContract({
        address: contract,
        abi: agenticCommerceAbi,
        functionName: "getJob",
        args: [BigInt(job.jobId)],
      });
      setLive(j);
    } catch {
      setLive(null);
    }
  }, [contract, job.jobId, wagmiCfg]);

  useEffect(() => {
    loadLive();
  }, [loadLive]);

  const decimals = TOKENS.USDC.decimals;
  const status = live ? JOB_STATUS_NAMES[Number(live.status)] : job.status;
  const budgetRaw = live ? live.budget : parseUnits(job.budget || "0", decimals);
  const hasBudget = budgetRaw > 0n;
  const description = live?.description ?? job.description;
  const client = (live?.client ?? job.client)?.toLowerCase();
  const provider = (live?.provider ?? job.provider)?.toLowerCase();
  const evaluator = (live?.evaluator ?? job.evaluator)?.toLowerCase();
  const me = address?.toLowerCase();

  const afterWrite = async () => {
    setPhase("recording");
    await api.syncJob(job.jobId).catch(() => null);
    await loadLive();
    setPhase("idle");
    onChanged();
  };

  const write = async (functionName, args) => {
    setError(null);
    setPhase("signing");
    try {
      const walletClient = await getWalletClient(wagmiCfg, { chainId: ENV.chainId });
      const publicClient = getPublicClient(wagmiCfg, { chainId: ENV.chainId });
      const hash = await walletClient.writeContract({
        address: contract,
        abi: agenticCommerceAbi,
        functionName,
        args,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await afterWrite();
    } catch (e) {
      setError(e.shortMessage || e.message);
      setPhase("error");
    }
  };

  const doSetBudget = () => write("setBudget", [BigInt(job.jobId), parseUnits(amount || "0", decimals), "0x"]);

  const doFund = async () => {
    setError(null);
    setPhase("signing");
    try {
      const walletClient = await getWalletClient(wagmiCfg, { chainId: ENV.chainId });
      const publicClient = getPublicClient(wagmiCfg, { chainId: ENV.chainId });
      const allowance = await publicClient.readContract({
        address: TOKENS.USDC.address,
        abi: erc20ApproveAbi,
        functionName: "allowance",
        args: [address, contract],
      });
      if (allowance < budgetRaw) {
        const approveHash = await walletClient.writeContract({
          address: TOKENS.USDC.address,
          abi: erc20ApproveAbi,
          functionName: "approve",
          args: [contract, budgetRaw],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }
      const fundHash = await walletClient.writeContract({
        address: contract,
        abi: agenticCommerceAbi,
        functionName: "fund",
        args: [BigInt(job.jobId), "0x"],
      });
      await publicClient.waitForTransactionReceipt({ hash: fundHash });
      await afterWrite();
    } catch (e) {
      setError(e.shortMessage || e.message);
      setPhase("error");
    }
  };

  const doSubmit = () =>
    write("submit", [BigInt(job.jobId), keccak256(toHex(deliverableText.trim() || "deliverable")), "0x"]);

  const doComplete = (approve) =>
    write("complete", [
      BigInt(job.jobId),
      keccak256(toHex(approve ? "deliverable-approved" : "deliverable-rejected")),
      "0x",
    ]);

  const busy = phase === "signing" || phase === "recording";

  return (
    <div className="card">
      <div className="row row-between">
        <strong>Job #{job.jobId}</strong>
        <StatusBadge status={status} />
      </div>
      <p className="text-sm mt-2">{description}</p>
      <div className="kv">
        <dt>Client</dt>
        <dd className="mono">{shortAddr(client)}</dd>
      </div>
      <div className="kv">
        <dt>Provider</dt>
        <dd className="mono">{shortAddr(provider)}</dd>
      </div>
      <div className="kv">
        <dt>Evaluator</dt>
        <dd className="mono">{shortAddr(evaluator)}</dd>
      </div>
      <div className="kv">
        <dt>Budget</dt>
        <dd>{fmtAmount(budgetRaw.toString(), decimals)} USDC</dd>
      </div>

      {error && phase === "error" && (
        <div className="notice notice-danger mt-3" role="alert">
          {error}
        </div>
      )}

      {status === "open" && !hasBudget && me === provider && (
        <div className="mt-3">
          <div className="field">
            <label>Set budget (USDC)</label>
            <input
              className="input"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={busy}
            />
          </div>
          <button className="btn btn-primary btn-sm" onClick={doSetBudget} disabled={busy || !amount || Number(amount) <= 0}>
            {busy && <span className="spinner" aria-hidden="true" />}
            Set budget
          </button>
        </div>
      )}

      {status === "open" && hasBudget && me === client && (
        <button className="btn btn-primary btn-sm mt-3" onClick={doFund} disabled={busy}>
          {busy && <span className="spinner" aria-hidden="true" />}
          Approve &amp; fund escrow
        </button>
      )}

      {status === "open" && hasBudget && me !== client && (
        <p className="text-xs faint mt-3">Waiting for the client to fund escrow.</p>
      )}

      {status === "funded" && me === provider && (
        <div className="mt-3">
          <div className="field">
            <label>Deliverable (hashed on-chain; the text itself stays off-chain)</label>
            <input
              className="input"
              placeholder="What you're submitting"
              value={deliverableText}
              onChange={(e) => setDeliverableText(e.target.value)}
              disabled={busy}
            />
          </div>
          <button className="btn btn-primary btn-sm" onClick={doSubmit} disabled={busy || !deliverableText.trim()}>
            {busy && <span className="spinner" aria-hidden="true" />}
            Submit deliverable
          </button>
        </div>
      )}

      {status === "funded" && me !== provider && (
        <p className="text-xs faint mt-3">Waiting for the provider to submit a deliverable.</p>
      )}

      {status === "submitted" && me === evaluator && (
        <div className="row mt-3">
          <button className="btn btn-primary btn-sm" onClick={() => doComplete(true)} disabled={busy}>
            {busy && <span className="spinner" aria-hidden="true" />}
            Approve (release funds)
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => doComplete(false)} disabled={busy}>
            Reject (refund client)
          </button>
        </div>
      )}

      {status === "submitted" && me !== evaluator && (
        <p className="text-xs faint mt-3">Waiting for the evaluator to resolve this job.</p>
      )}

      {["completed", "rejected", "expired"].includes(status) && (
        <div className="text-xs faint mt-3">
          Final state ·{" "}
          <a href={explorerAddressUrl(contract)} target="_blank" rel="noopener noreferrer">
            View contract ↗
          </a>
        </div>
      )}
    </div>
  );
}
