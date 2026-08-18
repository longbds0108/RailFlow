// Thin client for the RailFlow backend REST API.
import { ENV } from "./config";

const BASE = ENV.apiBase;

async function request(path, { method = "GET", body, credentials } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: credentials || "same-origin",
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const message = (data && (data.error || data.message)) || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// Streams newline-delimited JSON from POST /api/agent/chat, calling
// `onEvent` for each parsed line ({type:"delta"|"final"|"error", ...}).
async function agentChatStream(payload, onEvent) {
  const res = await fetch(`${BASE}/api/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  if (!res.ok || !res.body) {
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* no JSON body */
    }
    const message = (data && (data.error || data.message)) || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const emit = (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      onEvent(JSON.parse(trimmed));
    } catch {
      /* ignore a malformed line rather than break the stream */
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      emit(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 1);
    }
  }
  emit(buffer);
}

export const api = {
  health: () => request("/api/health"),
  getConfig: () => request("/api/config"),

  // Records
  recordSend: (payload) => request("/api/sends", { method: "POST", body: payload }),
  recordSwap: (payload) => request("/api/swaps", { method: "POST", body: payload }),
  recordBridge: (payload) => request("/api/bridges", { method: "POST", body: payload }),
  recordStake: (payload) => request("/api/stakes", { method: "POST", body: payload }),

  // AI agent
  agentChatStream,
  getAgentIdentity: () => request("/api/agent/identity"),

  // ERC-8183 jobs
  syncJob: (jobId) => request("/api/jobs/sync", { method: "POST", body: { jobId } }),
  getJobs: (address) => request(`/api/jobs?address=${encodeURIComponent(address)}`),
  submitJobDeliverable: (jobId, text) => request("/api/jobs/deliverable", { method: "POST", body: { jobId, text } }),

  // Open job marketplace (off-chain listings; see backend/src/db.js job_listings)
  postJobListing: (payload) => request("/api/jobs/listings", { method: "POST", body: payload }),
  getOpenJobListings: () => request("/api/jobs/listings"),
  getMyJobListings: (address) => request(`/api/jobs/listings?client=${encodeURIComponent(address)}`),
  getClaimedJobListings: (address) => request(`/api/jobs/listings?claimedBy=${encodeURIComponent(address)}`),
  claimJobListing: (id, address) => request(`/api/jobs/listings/${id}/claim`, { method: "POST", body: { address } }),
  cancelJobListing: (id) => request(`/api/jobs/listings/${id}/cancel`, { method: "POST" }),
  linkJobListing: (id, jobId) => request(`/api/jobs/listings/${id}/link`, { method: "POST", body: { jobId } }),
};
