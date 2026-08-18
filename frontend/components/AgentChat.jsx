"use client";

import { useEffect, useState } from "react";
import { useConfig } from "./ConfigProvider";
import { useWallet } from "../lib/useWallet";
import { api } from "../lib/api";
import { executeProposedAction } from "../lib/agentActions";
import { explorerTxUrl, explorerAddressUrl } from "../lib/config";
import Preview from "./Preview";

const ACTION_TITLES = {
  propose_send: "Confirm send",
  propose_swap: "Confirm swap",
  propose_stake: "Confirm stake action",
  propose_bridge: "Confirm bridge",
  propose_create_job: "Confirm job creation",
  propose_job_verdict: "Confirm job verdict",
};

const storageKey = (address) => `railflow:agent:${address?.toLowerCase()}`;

function actionRows(name, input) {
  switch (name) {
    case "propose_send":
      return [
        { label: "To", value: input.to, mono: true },
        { label: "Amount", value: `${input.amount} ${input.token}` },
        { label: "Network", value: "Arc Testnet" },
      ];
    case "propose_swap":
      return [
        { label: "From", value: `${input.amountIn} ${input.tokenIn}` },
        { label: "To", value: input.tokenOut },
        { label: "Network", value: "Arc Testnet" },
      ];
    case "propose_stake":
      return [
        { label: "Action", value: input.action },
        { label: "Token", value: input.token },
        ...(input.action !== "claim" ? [{ label: "Amount", value: `${input.amount} ${input.token}` }] : []),
      ];
    case "propose_bridge":
      return [
        { label: "From", value: input.fromChain },
        { label: "To", value: input.toChain },
        { label: "Amount", value: `${input.amount} ${input.token}` },
        { label: "Protocol", value: "Circle CCTP" },
      ];
    case "propose_create_job":
      return [
        { label: "Description", value: input.description },
        { label: "Provider", value: input.provider, mono: true },
        { label: "Evaluator", value: input.evaluator, mono: true },
        ...(input.listingId != null ? [{ label: "From listing", value: `#${input.listingId}` }] : []),
      ];
    case "propose_job_verdict":
      return [
        { label: "Job", value: `#${input.jobId}` },
        { label: "Verdict", value: input.verdict === "approve" ? "Approve (release funds)" : "Reject (refund client)" },
        { label: "Reason", value: input.reason },
      ];
    default:
      return Object.entries(input || {}).map(([label, value]) => ({ label, value: String(value) }));
  }
}

// Pull just the text blocks out of an Anthropic content array (or string) for
// display — tool_use / tool_result blocks are plumbing, not chat bubbles.
function textOf(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

// Addresses/hashes read a lot cleaner shortened, with the full value still
// available on hover — same convention as shortAddr() elsewhere in the app.
function shortHex(s) {
  return s.length > 14 ? `${s.slice(0, 8)}…${s.slice(-6)}` : s;
}

// Minimal inline-markdown pass for chat text: **bold**, `code`, and bare
// 0x… addresses/hashes — all auto-shortened. Keeps chat bubbles from
// showing raw asterisks/backticks/full-length hex (RailFlow addresses are
// 40 hex chars, tx hashes 64 — both unreadably long inline).
function renderInline(text, keyPrefix) {
  const out = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\b(0x[a-fA-F0-9]{12,})\b/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      out.push(<strong key={`${keyPrefix}-${i}`}>{m[1]}</strong>);
    } else {
      const raw = m[2] ?? m[3];
      const isHex = /^0x[a-fA-F0-9]{12,}$/.test(raw);
      // Tx hashes are 32 bytes (64 hex chars), addresses 20 bytes (40) —
      // link each to the right ArcScan page instead of just showing text.
      const hexLen = raw.length - 2;
      const href = !isHex ? null : hexLen >= 60 ? explorerTxUrl(raw) : hexLen >= 38 ? explorerAddressUrl(raw) : null;
      out.push(
        href ? (
          <a
            key={`${keyPrefix}-${i}`}
            className="chat-code chat-code-link"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={raw}
          >
            {shortHex(raw)}
          </a>
        ) : (
          <code key={`${keyPrefix}-${i}`} className="chat-code" title={isHex ? raw : undefined}>
            {isHex ? shortHex(raw) : raw}
          </code>
        )
      );
    }
    i += 1;
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// Renders a chat message as tight paragraphs/lists instead of raw
// whitespace-preserved text — collapses the blank-line-heavy formatting the
// model tends to produce down to compact blocks.
function MessageBody({ text }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.trim());
        const isList = lines.length > 0 && lines.every((l) => /^[-*]\s+/.test(l.trim()));
        if (isList) {
          return (
            <ul key={bi} style={{ margin: 0, paddingLeft: "1.1em" }}>
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.trim().replace(/^[-*]\s+/, ""), `${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi} style={{ margin: 0 }}>
            {lines.map((l, li) => (
              <span key={li}>
                {renderInline(l, `${bi}-${li}`)}
                {li < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function Bubble({ isUser, children }) {
  return (
    <div
      className="text-sm"
      style={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        maxWidth: "85%",
        padding: "var(--space-2) var(--space-3)",
        borderRadius: "var(--radius-md)",
        background: isUser ? "var(--color-primary)" : "var(--color-bg-elev)",
        color: isUser ? "var(--color-primary-contrast)" : "var(--color-text)",
        lineHeight: 1.45,
      }}
    >
      <MessageBody text={children} />
    </div>
  );
}

export default function AgentChat() {
  const { config } = useConfig();
  const { address } = useWallet();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const [actionPhase, setActionPhase] = useState("idle"); // idle | signing | recording
  const [actionError, setActionError] = useState(null);
  const [chatError, setChatError] = useState(null);
  const [identity, setIdentity] = useState(null);

  // The Assistant's own on-chain identity (see backend/scripts/registerAgentIdentity.js) —
  // one global fact, not per-wallet, so fetch once on mount.
  useEffect(() => {
    api
      .getAgentIdentity()
      .then((data) => setIdentity(data?.registered ? data : null))
      .catch(() => setIdentity(null));
  }, []);

  // Load this wallet's saved conversation whenever the connected address changes.
  useEffect(() => {
    if (!address) {
      setMessages([]);
      return;
    }
    try {
      const raw = window.localStorage.getItem(storageKey(address));
      setMessages(raw ? JSON.parse(raw) : []);
    } catch {
      setMessages([]);
    }
    setPendingAction(null);
    setStreamingText("");
    setChatError(null);
  }, [address]);

  // Persist on every change so a reload doesn't lose the conversation.
  useEffect(() => {
    if (!address) return;
    try {
      window.localStorage.setItem(storageKey(address), JSON.stringify(messages));
    } catch {
      /* storage full or unavailable — chat still works for this session */
    }
  }, [address, messages]);

  const ctx = {
    address,
    tokens: config?.tokens || {},
    stakingAddress: config?.stakingAddress,
    swapPoolAddress: config?.swapPoolAddress,
    defaultSlippageBps: config?.swap?.defaultSlippageBps,
    jobsContract: config?.jobs?.agenticCommerceContract,
    jobsDefaultExpirySeconds: config?.jobs?.defaultExpirySeconds,
  };

  const runTurn = async (nextMessages) => {
    setMessages(nextMessages);
    setSending(true);
    setChatError(null);
    setStreamingText("");
    try {
      await api.agentChatStream({ address, messages: nextMessages }, (event) => {
        if (event.type === "delta") {
          setStreamingText((t) => t + event.text);
        } else if (event.type === "final") {
          setMessages(event.messages);
          setPendingAction(event.status === "pending_action" ? event.pendingAction : null);
          setStreamingText("");
        } else if (event.type === "error") {
          setChatError("The assistant is unavailable right now.");
          setStreamingText("");
        }
      });
    } catch (e) {
      setChatError(e.message || "The assistant is unavailable right now.");
      setStreamingText("");
    } finally {
      setSending(false);
    }
  };

  const send = (text) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setInput("");
    runTurn([...messages, { role: "user", content: trimmed }]);
  };

  const confirmAction = async () => {
    if (!pendingAction) return;
    setActionPhase("signing");
    setActionError(null);
    let result;
    try {
      result = await executeProposedAction(pendingAction.name, pendingAction.input, ctx);
    } catch (e) {
      setActionError(e.shortMessage || e.message || String(e));
      setActionPhase("idle");
      return; // keep the card up so the user can retry or cancel
    }
    setActionPhase("recording");
    const declined = pendingAction;
    setPendingAction(null);
    await runTurn([
      ...messages,
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: declined.toolUseId,
            content: JSON.stringify({ confirmed: true, ...result }),
          },
        ],
      },
    ]);
    setActionPhase("idle");
  };

  const cancelAction = async () => {
    if (!pendingAction) return;
    const declined = pendingAction;
    setPendingAction(null);
    setActionError(null);
    await runTurn([
      ...messages,
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: declined.toolUseId,
            content: "The user declined to sign this transaction.",
            is_error: true,
          },
        ],
      },
    ]);
  };

  const clearChat = () => {
    setMessages([]);
    setPendingAction(null);
    setStreamingText("");
    setChatError(null);
    setActionError(null);
  };

  return (
    <div
      className="card"
      style={{ maxWidth: 640, padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
    >
      <div className="row row-between" style={{ gap: "var(--space-2)" }}>
        <div className="row" style={{ gap: "var(--space-2)" }}>
          {identity && (
            <a
              className="badge badge-success text-xs"
              href={explorerTxUrl(identity.registerTxHash) || undefined}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none" }}
            >
              ✓ Verified · ID #{identity.agentId}
            </a>
          )}
          <span className="faint text-xs">Saved on this device</span>
        </div>
        {messages.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={clearChat} disabled={sending}>
            Clear chat
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", minHeight: 140 }}>
        {messages.length === 0 && !streamingText && (
          <p className="muted text-sm">
            Ask me to check your balances or history, or to send, swap, stake, or bridge — I&apos;ll
            prepare it for you to review and sign in MetaMask.
          </p>
        )}
        {messages.map((m, i) => {
          const text = textOf(m.content);
          if (!text) return null;
          return (
            <Bubble key={i} isUser={m.role === "user"}>
              {text}
            </Bubble>
          );
        })}
        {streamingText && <Bubble isUser={false}>{streamingText}</Bubble>}
        {sending && !streamingText && <span className="muted text-xs">Thinking…</span>}
      </div>

      {pendingAction && (
        <Preview title={ACTION_TITLES[pendingAction.name] || "Confirm action"} rows={actionRows(pendingAction.name, pendingAction.input)}>
          {actionError && (
            <div className="notice notice-danger mt-3" role="alert">
              {actionError}
            </div>
          )}
          <div className="row mt-4">
            <button className="btn btn-primary" onClick={confirmAction} disabled={actionPhase !== "idle"}>
              {actionPhase !== "idle" && <span className="spinner" aria-hidden="true" />}
              {actionPhase === "signing"
                ? "Confirm in MetaMask…"
                : actionPhase === "recording"
                  ? "Recording…"
                  : "Confirm & sign"}
            </button>
            <button className="btn btn-ghost" onClick={cancelAction} disabled={actionPhase !== "idle"}>
              Cancel
            </button>
          </div>
        </Preview>
      )}

      {chatError && (
        <div className="notice notice-danger" role="alert">
          {chatError}
        </div>
      )}

      <form
        className="row"
        style={{ gap: "var(--space-2)" }}
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          className="input"
          style={{ flex: 1 }}
          placeholder="e.g. Send 1 USDC to 0x…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending || !!pendingAction}
        />
        <button className="btn btn-primary" type="submit" disabled={sending || !!pendingAction || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
