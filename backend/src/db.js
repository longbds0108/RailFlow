// SQLite store. Creates ./data dir and schema on boot.
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { env } from "./config.js";

mkdirSync(dirname(env.databasePath), { recursive: true });

export const db = new Database(env.databasePath);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS orders (
  id           TEXT PRIMARY KEY,
  packageId    TEXT NOT NULL,
  buyer        TEXT NOT NULL,
  amount       TEXT NOT NULL,          -- human USDC string, e.g. "1.00"
  receiver     TEXT NOT NULL,
  status       TEXT NOT NULL,          -- pending|processing|paid|failed|expired|cancelled
  txHash       TEXT UNIQUE,
  createdAt    INTEGER NOT NULL,
  expiresAt    INTEGER NOT NULL,
  paidAt       INTEGER
);

CREATE TABLE IF NOT EXISTS sends (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  address      TEXT NOT NULL,          -- sender wallet
  recipient    TEXT NOT NULL,          -- destination wallet
  token        TEXT NOT NULL,          -- USDC|EURC|cirBTC
  amount       TEXT NOT NULL,          -- human string
  txHash       TEXT UNIQUE NOT NULL,
  status       TEXT NOT NULL,          -- success|failed
  createdAt    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS swaps (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  address      TEXT NOT NULL,
  tokenIn      TEXT NOT NULL,
  tokenOut     TEXT NOT NULL,
  amountIn     TEXT NOT NULL,
  amountOut    TEXT,
  txHash       TEXT UNIQUE NOT NULL,
  status       TEXT NOT NULL,          -- draft|waiting_approval|waiting_signature|processing|success|failed
  createdAt    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bridges (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  address      TEXT NOT NULL,
  fromChain    TEXT NOT NULL,
  toChain      TEXT NOT NULL,
  token        TEXT NOT NULL,
  amount       TEXT NOT NULL,
  srcTxHash    TEXT UNIQUE NOT NULL,
  status       TEXT NOT NULL,          -- pending_source|source_confirmed|waiting_bridge|destination_processing|completed|failed
  createdAt    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS stakes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  address      TEXT NOT NULL,
  action       TEXT NOT NULL,          -- stake|unstake|claim
  token        TEXT NOT NULL,
  amount       TEXT NOT NULL,
  txHash       TEXT UNIQUE NOT NULL,
  status       TEXT NOT NULL,          -- no_stake|active|claimable|unstaking|completed|failed
  createdAt    INTEGER NOT NULL
);

-- ERC-8183 jobs (AgenticCommerce). One row per on-chain jobId, kept in sync by
-- re-reading getJob() on-chain (see POST /api/jobs/sync) — this table is a
-- cache/index for listing "jobs involving me", not the source of truth.
CREATE TABLE IF NOT EXISTS jobs (
  jobId        TEXT PRIMARY KEY,
  client       TEXT NOT NULL,
  provider     TEXT NOT NULL,
  evaluator    TEXT NOT NULL,
  description  TEXT,
  budget       TEXT NOT NULL,          -- human USDC string, "0" until set
  status       TEXT NOT NULL,          -- open|funded|submitted|completed|rejected|expired
  expiredAt    INTEGER,
  createdAt    INTEGER NOT NULL,
  updatedAt    INTEGER NOT NULL
);
`);

export default db;
