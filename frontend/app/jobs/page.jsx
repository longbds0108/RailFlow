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

// Shared by CreateJobCard (client types the provider address) and
// MyListingCard (client creates the job after someone claims their open
// listing) — the actual on-chain createJob() call is identical either way.
async function createJobOnChain({ contract, defaultExpirySeconds, provider, evaluator, description, wagmiCfg }) {
  const walletClient = await getWalletClient(wagmiCfg, { chainId: ENV.chainId });
  const publicClient = getPublicClient(wagmiCfg, { chainId: ENV.chainId });
  const block = await publicClient.getBlock();
  const expiredAt = block.timestamp + BigInt(defaultExpirySeconds);

  const txHash = await walletClient.writeContract({
    address: contract,
    abi: agenticCommerceAbi,
    functionName: "createJob",
    args: [provider, evaluator, expiredAt, description, ZERO_ADDRESS],
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
  return { txHash, jobId };
}

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
    <>
    <div className="grid grid-cols-3" style={{ gridTemplateColumns: "1fr 1.4fr" }}>
      <PostListingCard address={address} onPosted={refresh} />

      <div>
        <div className="row row-between" style={{ marginBottom: "var(--space-3)" }}>
          <h3 style={{ margin: 0 }}>Your jobs</h3>
          <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={loading}>
            Refresh
          </button>
        </div>
        {jobs.length === 0 && (
          <p className="muted text-sm">No jobs yet — post one below to get started.</p>
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

    <div className="mt-4">
      <MarketplaceSection address={address} refreshKey={refreshKey} onClaimed={refresh} />
    </div>

    <MyListingsSection
      address={address}
      contract={contract}
      defaultExpirySeconds={defaultExpirySeconds}
      wagmiCfg={wagmiCfg}
      refreshKey={refreshKey}
      onChanged={refresh}
    />
    <MyClaimsSection address={address} refreshKey={refreshKey} />
    </>
  );
}

function PostListingCard({ address, onPosted }) {
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [evaluator, setEvaluator] = useState("");
  const [phase, setPhase] = useState("form"); // form | posting | error
  const [error, setError] = useState(null);

  const valid = description.trim().length > 0 && (!evaluator || isAddress(evaluator));

  const post = async () => {
    setError(null);
    setPhase("posting");
    try {
      await api.postJobListing({
        client: address,
        description: description.trim(),
        budget: budget.trim() || undefined,
        evaluator: evaluator.trim() || undefined,
      });
      setPhase("form");
      setDescription("");
      setBudget("");
      setEvaluator("");
      onPosted();
    } catch (e) {
      setError(e.message);
      setPhase("error");
    }
  };

  const busy = phase === "posting";

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Post a job</h3>
      <p className="muted text-sm">
        No wallet signature yet — this just lists it below. Anyone (including you, to walk the
        whole lifecycle solo) can claim it; you create and fund the real on-chain job once
        someone does.
      </p>
      <div className="field">
        <label htmlFor="listingDescription">Description</label>
        <input
          id="listingDescription"
          className="input"
          placeholder="e.g. Design a logo for RailFlow"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={busy}
        />
      </div>
      <div className="field">
        <label htmlFor="listingBudget">Suggested budget (USDC, optional)</label>
        <input
          id="listingBudget"
          className="input"
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          placeholder="0.00"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          disabled={busy}
        />
      </div>
      <div className="field">
        <label htmlFor="listingEvaluator">Evaluator address (optional — defaults to you)</label>
        <input
          id="listingEvaluator"
          className="input mono"
          placeholder="0x…"
          value={evaluator}
          onChange={(e) => setEvaluator(e.target.value.trim())}
          disabled={busy}
        />
      </div>
      <button className="btn btn-primary btn-block" onClick={post} disabled={!valid || busy}>
        {busy && <span className="spinner" aria-hidden="true" />}
        Post to marketplace
      </button>
      {error && (
        <div className="notice notice-danger mt-3" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

function MarketplaceSection({ address, refreshKey, onClaimed }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [claimingId, setClaimingId] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setListings(await api.getOpenJobListings());
    } catch {
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const claim = async (id) => {
    setError(null);
    setClaimingId(id);
    try {
      await api.claimJobListing(id, address);
      await load();
      onClaimed();
    } catch (e) {
      setError(e.data?.error === "already_claimed" ? "Someone else just claimed this job." : e.message);
    } finally {
      setClaimingId(null);
    }
  };

  const me = address?.toLowerCase();

  return (
    <div className="card">
      <div className="row row-between" style={{ marginBottom: "var(--space-3)" }}>
        <h3 style={{ margin: 0 }}>Open jobs marketplace</h3>
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>
      {error && (
        <div className="notice notice-danger mt-2" role="alert">
          {error}
        </div>
      )}
      {listings.length === 0 && <p className="muted text-sm">No open jobs right now — check back later.</p>}
      <div className="stack" style={{ gap: "var(--space-3)" }}>
        {listings.map((l) => {
          const isOwn = l.client === me;
          return (
            <div key={l.id} className="card" style={{ background: "var(--color-bg-elev)" }}>
              <p className="text-sm" style={{ marginTop: 0 }}>
                {l.description}
              </p>
              <div className="kv">
                <dt>Client</dt>
                <dd className="mono">{shortAddr(l.client)}</dd>
              </div>
              {l.budget && (
                <div className="kv">
                  <dt>Suggested budget</dt>
                  <dd>{l.budget} USDC</dd>
                </div>
              )}
              <button
                className="btn btn-primary btn-sm mt-2"
                onClick={() => claim(l.id)}
                disabled={claimingId === l.id}
              >
                {claimingId === l.id && <span className="spinner" aria-hidden="true" />}
                {isOwn ? "Claim it yourself (solo test)" : "Claim this job"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MyListingsSection({ address, contract, defaultExpirySeconds, wagmiCfg, refreshKey, onChanged }) {
  const [listings, setListings] = useState([]);

  const load = useCallback(async () => {
    if (!address) return;
    try {
      setListings(await api.getMyJobListings(address));
    } catch {
      setListings([]);
    }
  }, [address]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (listings.length === 0) return null;

  return (
    <div className="card mt-4">
      <h3 style={{ marginTop: 0 }}>My postings</h3>
      <div className="stack" style={{ gap: "var(--space-3)" }}>
        {listings.map((l) => (
          <MyListingCard
            key={l.id}
            listing={l}
            contract={contract}
            defaultExpirySeconds={defaultExpirySeconds}
            wagmiCfg={wagmiCfg}
            onChanged={() => {
              load();
              onChanged();
            }}
          />
        ))}
      </div>
    </div>
  );
}

function MyListingCard({ listing, contract, defaultExpirySeconds, wagmiCfg, onChanged }) {
  const [phase, setPhase] = useState("idle"); // idle | creating | error
  const [error, setError] = useState(null);

  const createOnChain = async () => {
    setError(null);
    setPhase("creating");
    try {
      const { txHash, jobId } = await createJobOnChain({
        contract,
        defaultExpirySeconds,
        wagmiCfg,
        provider: listing.claimedBy,
        evaluator: listing.evaluator,
        description: listing.description,
      });
      await api.syncJob(jobId).catch(() => null);
      await api.linkJobListing(listing.id, jobId).catch(() => null);
      setPhase("idle");
      onChanged();
    } catch (e) {
      setError(e.shortMessage || e.message);
      setPhase("error");
    }
  };

  const cancel = async () => {
    setError(null);
    try {
      await api.cancelJobListing(listing.id);
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="card" style={{ background: "var(--color-bg-elev)" }}>
      <div className="row row-between">
        <p className="text-sm" style={{ margin: 0 }}>
          {listing.description}
        </p>
        <StatusBadge status={listing.status} />
      </div>
      {error && (
        <div className="notice notice-danger mt-2" role="alert">
          {error}
        </div>
      )}

      {listing.status === "open" && (
        <div className="row row-between mt-2">
          <p className="text-xs faint" style={{ margin: 0 }}>
            Waiting for someone to claim it.
          </p>
          <button className="btn btn-ghost btn-sm" onClick={cancel}>
            Cancel
          </button>
        </div>
      )}

      {listing.status === "claimed" && (
        <div className="mt-2">
          <p className="text-xs faint">
            Claimed by <span className="mono">{shortAddr(listing.claimedBy)}</span> — create the real job
            on-chain to fund escrow.
          </p>
          <button className="btn btn-primary btn-sm" onClick={createOnChain} disabled={phase === "creating"}>
            {phase === "creating" && <span className="spinner" aria-hidden="true" />}
            Create job on-chain
          </button>
        </div>
      )}

      {listing.status === "created" && (
        <p className="text-xs faint mt-2">Job #{listing.jobId} created — see it under &quot;Your jobs&quot; above.</p>
      )}

      {listing.status === "cancelled" && <p className="text-xs faint mt-2">Cancelled.</p>}
    </div>
  );
}

function MyClaimsSection({ address, refreshKey }) {
  const [listings, setListings] = useState([]);

  const load = useCallback(async () => {
    if (!address) return;
    try {
      setListings(await api.getClaimedJobListings(address));
    } catch {
      setListings([]);
    }
  }, [address]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (listings.length === 0) return null;

  return (
    <div className="card mt-4">
      <h3 style={{ marginTop: 0 }}>Jobs I&apos;ve claimed</h3>
      <div className="stack" style={{ gap: "var(--space-3)" }}>
        {listings.map((l) => (
          <div key={l.id} className="card" style={{ background: "var(--color-bg-elev)" }}>
            <div className="row row-between">
              <p className="text-sm" style={{ margin: 0 }}>
                {l.description}
              </p>
              <StatusBadge status={l.status} />
            </div>
            <p className="text-xs faint mt-2">
              {l.status === "claimed" && "Waiting for the client to create and fund the on-chain job."}
              {l.status === "created" && `Job #${l.jobId} is live — check "Your jobs" above.`}
            </p>
          </div>
        ))}
      </div>
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

  const doSubmit = async () => {
    const text = deliverableText.trim() || "deliverable";
    await write("submit", [BigInt(job.jobId), keccak256(toHex(text)), "0x"]);
    // Only the hash goes on-chain; save the actual text so the Assistant (or
    // anyone reviewing) can later read what was submitted. Best-effort — a
    // failure here shouldn't undo the on-chain submission that already succeeded.
    await api.submitJobDeliverable(job.jobId, text).catch(() => null);
  };

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
