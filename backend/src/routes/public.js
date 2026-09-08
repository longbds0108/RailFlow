// Public REST endpoints: health, config, sends, record endpoints.
import { Router } from "express";
import { db } from "../db.js";
import { arc, publicConfig, getJobVaultAddress } from "../config.js";
import { verifyTokenTransfer, txSucceeded, getJobOnChain } from "../chain.js";
import { getActivityForAddress } from "../activity.js";
import { formatUnits } from "viem";

const router = Router();

const isTxHash = (v) => typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v);
const isAddress = (v) => typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);

router.get("/health", (_req, res) => {
  res.json({ ok: true });
});

router.get("/config", (_req, res) => {
  res.json(publicConfig());
});

// --- Sends ----------------------------------------------------------------
// Generic token transfer (USDC/EURC/cirBTC) to any recipient. The frontend
// signs the ERC-20 transfer in MetaMask, then reports the tx here; the backend
// verifies the on-chain Transfer to the recipient for the amount, then stores it.

router.post("/sends", async (req, res) => {
  const { address, to, token, amount, txHash } = req.body || {};
  if (!isAddress(address)) return res.status(400).json({ error: "invalid_address" });
  if (!isAddress(to)) return res.status(400).json({ error: "invalid_recipient" });
  if (!isTxHash(txHash)) return res.status(400).json({ error: "invalid_txHash" });
  if (amount == null || Number(amount) <= 0) return res.status(400).json({ error: "invalid_amount" });

  const tokenMeta = arc.tokens[token];
  if (!tokenMeta || !tokenMeta.address) return res.status(400).json({ error: "unknown_token" });

  if (db.prepare("SELECT id FROM sends WHERE txHash = ?").get(txHash)) {
    return res.status(409).json({ error: "tx_already_recorded" });
  }

  const result = await verifyTokenTransfer({
    txHash,
    receiver: to,
    amountHuman: amount,
    tokenAddress: tokenMeta.address,
    decimals: tokenMeta.decimals,
  });
  const status = result.ok ? "success" : "failed";

  const info = db
    .prepare(
      `INSERT INTO sends (address, recipient, token, amount, txHash, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(address.toLowerCase(), to.toLowerCase(), String(token), String(amount), txHash, status, Date.now());
  res.status(201).json({ ...db.prepare("SELECT * FROM sends WHERE id = ?").get(info.lastInsertRowid), verification: result });
});

// --- Record endpoints (verify on-chain, then store) -----------------------

router.post("/swaps", async (req, res) => {
  const { address, tokenIn, tokenOut, amountIn, amountOut, txHash } = req.body || {};
  if (!isAddress(address)) return res.status(400).json({ error: "invalid_address" });
  if (!isTxHash(txHash)) return res.status(400).json({ error: "invalid_txHash" });
  if (!tokenIn || !tokenOut || amountIn == null) return res.status(400).json({ error: "missing_fields" });
  if (db.prepare("SELECT id FROM swaps WHERE txHash = ?").get(txHash)) {
    return res.status(409).json({ error: "tx_already_recorded" });
  }

  const status = (await txSucceeded(txHash)) ? "success" : "failed";
  const info = db
    .prepare(
      `INSERT INTO swaps (address, tokenIn, tokenOut, amountIn, amountOut, txHash, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(address.toLowerCase(), String(tokenIn), String(tokenOut), String(amountIn), amountOut != null ? String(amountOut) : null, txHash, status, Date.now());
  res.status(201).json(db.prepare("SELECT * FROM swaps WHERE id = ?").get(info.lastInsertRowid));
});

router.post("/bridges", async (req, res) => {
  const { address, fromChain, toChain, token, amount, srcTxHash } = req.body || {};
  if (!isAddress(address)) return res.status(400).json({ error: "invalid_address" });
  if (!isTxHash(srcTxHash)) return res.status(400).json({ error: "invalid_srcTxHash" });
  if (!fromChain || !toChain || !token || amount == null) return res.status(400).json({ error: "missing_fields" });
  if (db.prepare("SELECT id FROM bridges WHERE srcTxHash = ?").get(srcTxHash)) {
    return res.status(409).json({ error: "tx_already_recorded" });
  }

  // Source confirmed if the source tx succeeded; full bridge completion is async (CCTP).
  const status = (await txSucceeded(srcTxHash)) ? "source_confirmed" : "pending_source";
  const info = db
    .prepare(
      `INSERT INTO bridges (address, fromChain, toChain, token, amount, srcTxHash, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(address.toLowerCase(), String(fromChain), String(toChain), String(token), String(amount), srcTxHash, status, Date.now());
  res.status(201).json(db.prepare("SELECT * FROM bridges WHERE id = ?").get(info.lastInsertRowid));
});

router.post("/stakes", async (req, res) => {
  const { address, action, token, amount, txHash } = req.body || {};
  if (!isAddress(address)) return res.status(400).json({ error: "invalid_address" });
  if (!isTxHash(txHash)) return res.status(400).json({ error: "invalid_txHash" });
  if (!["stake", "unstake", "claim"].includes(action)) return res.status(400).json({ error: "invalid_action" });
  if (!token || amount == null) return res.status(400).json({ error: "missing_fields" });
  if (db.prepare("SELECT id FROM stakes WHERE txHash = ?").get(txHash)) {
    return res.status(409).json({ error: "tx_already_recorded" });
  }

  const ok = await txSucceeded(txHash);
  let status;
  if (!ok) status = "failed";
  else if (action === "stake") status = "active";
  else if (action === "unstake") status = "completed";
  else status = "completed"; // claim
  const info = db
    .prepare(
      `INSERT INTO stakes (address, action, token, amount, txHash, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(address.toLowerCase(), action, String(token), String(amount), txHash, status, Date.now());
  res.status(201).json(db.prepare("SELECT * FROM stakes WHERE id = ?").get(info.lastInsertRowid));
});

// --- Jobs (unified activity log) --------------------------------------------
// Merges sends/swaps/stakes/bridges/marketplace-jobs into one per-wallet feed
// — see backend/src/activity.js. Not to be confused with the AI-agent escrow
// marketplace below (client/provider/evaluator jobs), which lives under
// /marketplace/* to avoid the name collision.

router.get("/jobs", (req, res) => {
  const address = String(req.query.address || "");
  if (!isAddress(address)) return res.status(400).json({ error: "invalid_address" });
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  res.json(getActivityForAddress(address, { limit }));
});

// --- Escrow marketplace (ERC-8183-style AI job escrow) ----------------------
// Every write happens client-side in the user's own wallet; the backend only
// ever reads getJob() on-chain and caches it, so a job can be synced by
// anyone (it's public on-chain state either way).

const isJobId = (v) => typeof v === "string" && /^\d+$/.test(v);

router.post("/marketplace/jobs/sync", async (req, res) => {
  const { jobId } = req.body || {};
  if (!isJobId(String(jobId ?? ""))) return res.status(400).json({ error: "invalid_jobId" });

  const jobVaultAddress = getJobVaultAddress();
  if (!jobVaultAddress) return res.status(503).json({ error: "job_vault_not_deployed" });

  let job;
  try {
    job = await getJobOnChain(jobVaultAddress, jobId);
  } catch {
    return res.status(404).json({ error: "job_not_found" });
  }
  // The contract returns a zero-initialized struct for an unknown jobId rather
  // than reverting — treat an empty client as "not found" instead of caching it.
  if (!job.client || /^0x0+$/i.test(job.client)) {
    return res.status(404).json({ error: "job_not_found" });
  }

  const now = Date.now();
  db.prepare(
    `INSERT INTO jobs (jobId, client, provider, evaluator, description, budget, requiredStake, status, expiredAt, createdAt, updatedAt)
     VALUES (@jobId, @client, @provider, @evaluator, @description, @budget, @requiredStake, @status, @expiredAt, @now, @now)
     ON CONFLICT(jobId) DO UPDATE SET
       client = excluded.client,
       provider = excluded.provider,
       evaluator = excluded.evaluator,
       description = excluded.description,
       budget = excluded.budget,
       requiredStake = excluded.requiredStake,
       status = excluded.status,
       expiredAt = excluded.expiredAt,
       updatedAt = excluded.updatedAt`
  ).run({
    jobId: String(jobId),
    client: job.client.toLowerCase(),
    provider: job.provider.toLowerCase(),
    evaluator: job.evaluator.toLowerCase(),
    description: job.description,
    budget: formatUnits(job.budget, arc.tokens.USDC.decimals),
    requiredStake: formatUnits(job.requiredStake, arc.tokens.USDC.decimals),
    status: arc.jobs.statusNames[Number(job.status)] || "open",
    expiredAt: Number(job.expiredAt),
    now,
  });

  res.json(db.prepare("SELECT * FROM jobs WHERE jobId = ?").get(String(jobId)));
});

router.get("/marketplace/jobs", (req, res) => {
  const address = String(req.query.address || "").toLowerCase();
  if (!isAddress(address)) return res.status(400).json({ error: "invalid_address" });
  const rows = db
    .prepare("SELECT * FROM jobs WHERE client = ? OR provider = ? OR evaluator = ? ORDER BY updatedAt DESC")
    .all(address, address, address);
  res.json(rows);
});

// Only the deliverable's keccak256 hash goes on-chain (submit() takes bytes32,
// not the text). The Assistant needs the actual text to evaluate a submission
// against the job description, so the provider's browser posts it here right
// after the on-chain submit() confirms — call /marketplace/jobs/sync first so
// this only accepts it once the cached status has caught up to "submitted".
router.post("/marketplace/jobs/deliverable", (req, res) => {
  const { jobId, text } = req.body || {};
  if (!isJobId(String(jobId ?? ""))) return res.status(400).json({ error: "invalid_jobId" });
  if (typeof text !== "string" || !text.trim()) return res.status(400).json({ error: "invalid_text" });

  const row = db.prepare("SELECT * FROM jobs WHERE jobId = ?").get(String(jobId));
  if (!row) return res.status(404).json({ error: "job_not_found" });
  if (row.status !== "submitted") return res.status(409).json({ error: "job_not_submitted" });

  db.prepare("UPDATE jobs SET deliverableText = ?, updatedAt = ? WHERE jobId = ?").run(
    text.trim(),
    Date.now(),
    String(jobId)
  );
  res.json(db.prepare("SELECT * FROM jobs WHERE jobId = ?").get(String(jobId)));
});

// --- Open job marketplace ---------------------------------------------------
// Off-chain listings: a client posts one for free (no gas, no signature), any
// wallet can claim it, and only then does the client sign the real on-chain
// createJob() — same flow as a direct-assign job, just with the provider
// address filled in by whoever claimed instead of typed by the client.

router.post("/marketplace/listings", (req, res) => {
  const { client, description, budget, evaluator, requiredStake } = req.body || {};
  if (!isAddress(client)) return res.status(400).json({ error: "invalid_client" });
  if (typeof description !== "string" || !description.trim()) {
    return res.status(400).json({ error: "invalid_description" });
  }
  // The budget is now locked into JobEscrowVault at job-creation time (no
  // separate provider-side setBudget step), so it must be a real number here.
  if (budget == null || Number(budget) <= 0) return res.status(400).json({ error: "invalid_budget" });
  if (evaluator != null && evaluator !== "" && !isAddress(evaluator)) {
    return res.status(400).json({ error: "invalid_evaluator" });
  }
  if (requiredStake != null && requiredStake !== "" && Number(requiredStake) < 0) {
    return res.status(400).json({ error: "invalid_requiredStake" });
  }

  const now = Date.now();
  const info = db
    .prepare(
      `INSERT INTO job_listings (client, description, budget, evaluator, status, requiredStake, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 'open', ?, ?, ?)`
    )
    .run(
      client.toLowerCase(),
      description.trim(),
      String(budget),
      (evaluator && evaluator !== "" ? evaluator : client).toLowerCase(),
      requiredStake != null && requiredStake !== "" ? String(requiredStake) : "0",
      now,
      now
    );
  res.status(201).json(db.prepare("SELECT * FROM job_listings WHERE id = ?").get(info.lastInsertRowid));
});

router.get("/marketplace/listings", (req, res) => {
  const { client, claimedBy } = req.query;
  if (client) {
    if (!isAddress(String(client))) return res.status(400).json({ error: "invalid_client" });
    return res.json(
      db
        .prepare("SELECT * FROM job_listings WHERE client = ? ORDER BY updatedAt DESC")
        .all(String(client).toLowerCase())
    );
  }
  if (claimedBy) {
    if (!isAddress(String(claimedBy))) return res.status(400).json({ error: "invalid_claimedBy" });
    return res.json(
      db
        .prepare("SELECT * FROM job_listings WHERE claimedBy = ? ORDER BY updatedAt DESC")
        .all(String(claimedBy).toLowerCase())
    );
  }
  // The public marketplace view: everything still open for anyone to claim.
  res.json(db.prepare("SELECT * FROM job_listings WHERE status = 'open' ORDER BY createdAt DESC").all());
});

router.post("/marketplace/listings/:id/claim", (req, res) => {
  const id = Number(req.params.id);
  const { address } = req.body || {};
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "invalid_id" });
  if (!isAddress(address)) return res.status(400).json({ error: "invalid_address" });

  const listing = db.prepare("SELECT * FROM job_listings WHERE id = ?").get(id);
  if (!listing) return res.status(404).json({ error: "listing_not_found" });
  // Self-claiming is allowed on purpose — same "one wallet can hold every
  // role" philosophy as the rest of this app, so solo testing works here too.

  // Race-safe: only succeeds if it's still open, so two simultaneous
  // claimers can't both "win" the same listing.
  const result = db
    .prepare("UPDATE job_listings SET status = 'claimed', claimedBy = ?, updatedAt = ? WHERE id = ? AND status = 'open'")
    .run(address.toLowerCase(), Date.now(), id);
  if (result.changes === 0) return res.status(409).json({ error: "already_claimed" });

  res.json(db.prepare("SELECT * FROM job_listings WHERE id = ?").get(id));
});

router.post("/marketplace/listings/:id/cancel", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "invalid_id" });

  const result = db
    .prepare("UPDATE job_listings SET status = 'cancelled', updatedAt = ? WHERE id = ? AND status = 'open'")
    .run(Date.now(), id);
  if (result.changes === 0) return res.status(409).json({ error: "not_cancellable" });

  res.json(db.prepare("SELECT * FROM job_listings WHERE id = ?").get(id));
});

// Called by the client's browser right after the real createJob() tx
// confirms, so the listing shows the finished on-chain job instead of
// sitting at "claimed" forever.
router.post("/marketplace/listings/:id/link", (req, res) => {
  const id = Number(req.params.id);
  const { jobId } = req.body || {};
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "invalid_id" });
  if (!isJobId(String(jobId ?? ""))) return res.status(400).json({ error: "invalid_jobId" });

  const result = db
    .prepare("UPDATE job_listings SET status = 'created', jobId = ?, updatedAt = ? WHERE id = ? AND status = 'claimed'")
    .run(String(jobId), Date.now(), id);
  if (result.changes === 0) return res.status(409).json({ error: "not_linkable" });

  res.json(db.prepare("SELECT * FROM job_listings WHERE id = ?").get(id));
});


export default router;
