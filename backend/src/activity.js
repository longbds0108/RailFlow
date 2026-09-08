// Unified per-wallet activity log: merges every module's own history table
// into one sorted feed. Single source of truth for both GET /api/jobs (the
// "Jobs" activity-log page) and the Assistant's get_history tool — these used
// to duplicate this merge logic independently and drifted (the agent's copy
// never picked up the escrow `jobs` table).
import { db } from "./db.js";

const SOURCES = [
  { table: "sends", type: "send", addressCols: ["address"] },
  { table: "swaps", type: "swap", addressCols: ["address"] },
  { table: "stakes", type: "stake", addressCols: ["address"] },
  { table: "bridges", type: "bridge", addressCols: ["address"] },
  { table: "jobs", type: "marketplace_job", addressCols: ["client", "provider", "evaluator"] },
];

/** Merge every activity source for `address`, newest first, capped at `limit`. */
export function getActivityForAddress(address, { limit = 50 } = {}) {
  const addr = address.toLowerCase();
  const rows = SOURCES.flatMap(({ table, type, addressCols }) => {
    const where = addressCols.map((c) => `${c} = ?`).join(" OR ");
    const params = addressCols.map(() => addr);
    return db
      .prepare(`SELECT * FROM ${table} WHERE ${where}`)
      .all(...params)
      .map((row) => ({ type, ...row }));
  });

  return rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}
