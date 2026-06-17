// Thin client for the ArcFlow backend REST API.
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

export const api = {
  health: () => request("/api/health"),
  getConfig: () => request("/api/config"),

  // History
  getHistory: (address) => request(`/api/history?address=${encodeURIComponent(address)}`),

  // Records
  recordSend: (payload) => request("/api/sends", { method: "POST", body: payload }),
  recordSwap: (payload) => request("/api/swaps", { method: "POST", body: payload }),
  recordBridge: (payload) => request("/api/bridges", { method: "POST", body: payload }),
  recordStake: (payload) => request("/api/stakes", { method: "POST", body: payload }),
};
