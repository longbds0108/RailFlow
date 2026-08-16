// Public REST endpoints: health, config, sends, record endpoints.
import { Router } from "express";
import { db } from "../db.js";
import { arc, publicConfig, env, getAgentIdentity } from "../config.js";
import { verifyTokenTransfer, txSucceeded, getJobOnChain } from "../chain.js";
import { formatUnits } from "viem";
import { runAgentTurn } from "../agent.js";

const router = Router();

const isTxHash = (v) => typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v);
const isAddress = (v) => typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);

router.get("/health", (_req, res) => {
  res.json({ ok: true });
});

router.get("/config", (_req, res) => {
  res.json(publicConfig());
});

// ERC-8004 identity for the Assistant (see scripts/registerAgentIdentity.js).
// Read-only — no secrets in this shape (wallet addresses + agent ID are public
// on-chain facts once registered).
router.get("/agent/identity", (_req, res) => {
  const identity = getAgentIdentity();
  if (!identity) return res.json({ registered: false });
  res.json({
    registered: true,
    agentId: identity.agentId,
    ownerWalletAddress: identity.ownerWalletAddress,
    metadataURI: identity.metadataURI,
    registerTxHash: identity.registerTxHash,
    registeredAt: identity.registeredAt,
  });
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

// --- ERC-8183 jobs ----------------------------------------------------------
// Every write happens client-side in the user's own wallet; the backend only
// ever reads getJob() on-chain and caches it, so a job can be synced by
// anyone (it's public on-chain state either way).

const isJobId = (v) => typeof v === "string" && /^\d+$/.test(v);

router.post("/jobs/sync", async (req, res) => {
  const { jobId } = req.body || {};
  if (!isJobId(String(jobId ?? ""))) return res.status(400).json({ error: "invalid_jobId" });

  let job;
  try {
    job = await getJobOnChain(arc.jobs.agenticCommerceContract, jobId);
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
    `INSERT INTO jobs (jobId, client, provider, evaluator, description, budget, status, expiredAt, createdAt, updatedAt)
     VALUES (@jobId, @client, @provider, @evaluator, @description, @budget, @status, @expiredAt, @now, @now)
     ON CONFLICT(jobId) DO UPDATE SET
       client = excluded.client,
       provider = excluded.provider,
       evaluator = excluded.evaluator,
       description = excluded.description,
       budget = excluded.budget,
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
    status: arc.jobs.statusNames[Number(job.status)] || "open",
    expiredAt: Number(job.expiredAt),
    now,
  });

  res.json(db.prepare("SELECT * FROM jobs WHERE jobId = ?").get(String(jobId)));
});

router.get("/jobs", (req, res) => {
  const address = String(req.query.address || "").toLowerCase();
  if (!isAddress(address)) return res.status(400).json({ error: "invalid_address" });
  const rows = db
    .prepare("SELECT * FROM jobs WHERE client = ? OR provider = ? OR evaluator = ? ORDER BY updatedAt DESC")
    .all(address, address, address);
  res.json(rows);
});

// --- AI agent -----------------------------------------------------------
// Chat conversation state (Anthropic message array) is held by the client and
// sent whole each turn — the backend keeps no chat session. Read tools run
// here; propose_* tool calls are handed back untouched for the frontend to
// preview and the user to sign — the agent never executes a transaction.
//
// Streamed as newline-delimited JSON so the client can render assistant text
// as it's generated: zero or more {"type":"delta","text":"..."} lines, then
// exactly one {"type":"final",...} or {"type":"error",...} line.

router.post("/agent/chat", async (req, res) => {
  const { address, messages } = req.body || {};
  if (!isAddress(address)) return res.status(400).json({ error: "invalid_address" });
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) {
    return res.status(400).json({ error: "invalid_messages" });
  }
  if (!env.anthropicApiKey) return res.status(503).json({ error: "agent_not_configured" });

  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");

  const write = (event) => res.write(JSON.stringify(event) + "\n");

  try {
    const result = await runAgentTurn({
      address,
      messages,
      onTextDelta: (text) => write({ type: "delta", text }),
    });
    write({ type: "final", ...result });
  } catch (e) {
    console.error(e);
    write({ type: "error", error: "agent_request_failed" });
  } finally {
    res.end();
  }
});

export default router;
