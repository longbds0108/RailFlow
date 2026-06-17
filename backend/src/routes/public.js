// Public REST endpoints: health, config, sends, history, record endpoints.
import { Router } from "express";
import { db } from "../db.js";
import { arc, publicConfig } from "../config.js";
import { verifyTokenTransfer, txSucceeded } from "../chain.js";

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

// --- History --------------------------------------------------------------

router.get("/history", (req, res) => {
  const address = String(req.query.address || "").toLowerCase();
  if (!isAddress(address)) return res.status(400).json({ error: "invalid_address" });

  const sends = db
    .prepare("SELECT * FROM sends WHERE address = ?")
    .all(address)
    .map((s) => ({ type: "send", id: s.id, status: s.status, token: s.token, amount: s.amount, recipient: s.recipient, txHash: s.txHash, createdAt: s.createdAt }));

  const swaps = db
    .prepare("SELECT * FROM swaps WHERE address = ?")
    .all(address)
    .map((s) => ({ type: "swap", id: s.id, status: s.status, tokenIn: s.tokenIn, tokenOut: s.tokenOut, amountIn: s.amountIn, amountOut: s.amountOut, txHash: s.txHash, createdAt: s.createdAt }));

  const stakes = db
    .prepare("SELECT * FROM stakes WHERE address = ?")
    .all(address)
    .map((s) => ({ type: "stake", id: s.id, status: s.status, action: s.action, token: s.token, amount: s.amount, txHash: s.txHash, createdAt: s.createdAt }));

  const bridges = db
    .prepare("SELECT * FROM bridges WHERE address = ?")
    .all(address)
    .map((b) => ({ type: "bridge", id: b.id, status: b.status, fromChain: b.fromChain, toChain: b.toChain, token: b.token, amount: b.amount, txHash: b.srcTxHash, createdAt: b.createdAt }));

  const all = [...sends, ...swaps, ...stakes, ...bridges].sort((a, b) => b.createdAt - a.createdAt);
  res.json(all);
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

export default router;
