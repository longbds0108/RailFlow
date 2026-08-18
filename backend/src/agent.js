// AI transaction agent: Claude (tool use) proposes Payment/Swap/Staking/Bridge/
// Job actions; it never signs an on-chain transaction itself. Read tools and a
// couple of gas-free, signature-free writes (posting/claiming a marketplace
// listing) run directly here. Any propose_* tool call ends the turn
// immediately and is handed back to the frontend as a pending action — the
// user still reviews and signs every transaction in MetaMask, exactly like
// the manual forms.
import Anthropic from "@anthropic-ai/sdk";
import { env, arc, publicConfig, getStakingAddress, getAgentIdentity } from "./config.js";
import { db } from "./db.js";
import { publicClient } from "./chain.js";

const anthropic = new Anthropic({ apiKey: env.anthropicApiKey });

const MODEL = "claude-opus-5";
const MAX_TURNS = 6;
const PROPOSE_PREFIX = "propose_";

const balanceOfAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
];

const stakingReadAbi = [
  {
    type: "function",
    name: "stakeInfo",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "token", type: "address" },
    ],
    outputs: [
      { name: "amount", type: "uint256" },
      { name: "rewardDebt", type: "uint256" },
      { name: "since", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "pendingReward",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "token", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
];

function systemPrompt(address) {
  const cfg = publicConfig();
  const tokens = Object.keys(cfg.tokens).join(", ");
  const pairs = cfg.swap.pairs.map((p) => p.join("/")).join(", ");
  const chains = cfg.bridge.supportedChains.map((c) => c.label).join(", ");

  return `You are the RailFlow Assistant, built into a self-custody testnet dApp on Arc Testnet (Circle's chain).

Core rule: you never hold or use a private key, and you never execute a transaction yourself. When the user wants to send, swap, stake, bridge, create a job, or resolve a job, call the matching propose_* tool with the exact parameters — the app then shows the user a preview and they confirm and sign it themselves in MetaMask. Never claim a transaction succeeded, failed, or has a hash unless a tool result told you so.

Connected wallet: ${address}. When the user says they'll do something themselves (e.g. "I'll be the provider too"), use this address rather than asking for it again.

Network: ${cfg.network.name} (chainId ${cfg.network.chainId}).
Tokens: ${tokens}.
Swap pairs: ${pairs}. Default slippage: ${cfg.swap.defaultSlippageBps} bps.
Staking: reward token ${cfg.staking.rewardToken}, APY ${(cfg.staking.apyBps / 100).toFixed(2)}%, min stake ${cfg.staking.minStake} ${(cfg.staking.stakableTokens || []).join("/")}.
Bridge chains: ${chains} (token: ${cfg.bridge.tokens.join(", ")}).

Jobs (ERC-8183 escrow, contract ${cfg.jobs.agenticCommerceContract}): a client creates a job and funds USDC escrow, a provider submits a deliverable, an evaluator releases funds to the provider or refunds the client. The on-chain contract always needs a concrete provider address — there's no "unassigned" job on-chain — so an open marketplace of off-chain listings sits in front of it:
- Creating a job when the user already knows who'll do the work: write a clear, specific description with explicit, checkable acceptance criteria (not vague — e.g. "Summarize X in 150-250 words, covering A, B and C" rather than "write a summary"), then call propose_create_job. If provider/evaluator aren't given, ask, unless the user implies they'll hold that role themselves — then use the connected wallet.
- Client doesn't know who'll do it yet ("I need someone to...", "post a job", "tìm người làm"): write the same kind of clear description with acceptance criteria, then call post_job_listing (no signature needed, do it directly). Don't call propose_create_job yet — there's no provider to assign.
- User is looking for work ("tìm việc", "có job nào không"): call get_open_job_listings and summarize what's available.
- User wants to take/claim a specific open listing: call claim_job_listing (no signature needed, do it directly) once they've confirmed which one. After claiming, tell them work shouldn't start until the client has created and funded the real on-chain job — check with get_my_job_listings-equivalent status if they ask.
- Client checking on their listings ("did anyone take my job?"): call get_my_job_listings. If one shows status "claimed", offer to create the real on-chain job now — call propose_create_job with provider set to that listing's claimedBy, evaluator to its evaluator, description to its description, and listingId set to that listing's id (this links the listing to the resulting job automatically).
- Evaluating a submission: when asked to evaluate/check a submitted job, call get_job_details first — its description is the acceptance criteria, its deliverableText is what the provider actually submitted. Compare them carefully, then:
  - Clearly meets all criteria → call propose_job_verdict with verdict "approve" and a specific reason citing what was satisfied.
  - Clearly fails or is missing required parts → call propose_job_verdict with verdict "reject" and a specific reason naming exactly what's missing or wrong.
  - Ambiguous or only partially meets criteria → do NOT call propose_job_verdict. Explain the ambiguity in plain text (what's met, what's unclear) and say this needs the evaluator's own judgment call.
  Only propose a verdict when you're confident — false confidence here releases or withholds real (testnet) escrowed funds.

${cfg.disclaimer.en}

If asked whether you are verified, have an on-chain identity, or similar, use the get_agent_identity tool rather than guessing — do not claim to be verified unless it confirms registered: true.

Keep replies short and concrete. If a request is ambiguous (missing token, amount, or recipient), ask one brief clarifying question instead of guessing.`;
}

const TOOLS = [
  {
    name: "get_config",
    description:
      "Get RailFlow's current network, token, swap, staking, and bridge configuration. Use this to check what's supported before proposing an action.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_balances",
    description:
      "Get the connected user's current token balances on Arc Testnet. Always uses the connected wallet — there is no address parameter.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_history",
    description:
      "Get the connected user's recent payment, swap, stake, and bridge history, newest first.",
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          description: "Max number of items to return (default 10, max 50).",
        },
      },
      required: [],
    },
  },
  {
    name: "get_staking_position",
    description:
      "Get the connected user's current staked amount and pending reward for a given token.",
    input_schema: {
      type: "object",
      properties: {
        token: {
          type: "string",
          enum: arc.staking.stakableTokens,
          description: "Token to check the staking position for.",
        },
      },
      required: ["token"],
    },
  },
  {
    name: "get_agent_identity",
    description:
      "Check whether this assistant has a registered ERC-8004 on-chain identity on Arc Testnet (IdentityRegistry), and return its Agent ID and registration details if so. Use this when the user asks whether you are verified, have an on-chain identity, or similar.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_job_details",
    description:
      "Get a job's description (which doubles as its acceptance criteria), status, budget, roles, and — if a provider has submitted one — the deliverable text. Use this before evaluating a submission. Only works for jobs the connected wallet is a party to.",
    input_schema: {
      type: "object",
      properties: {
        jobId: { type: "string", description: "The job's on-chain id." },
      },
      required: ["jobId"],
    },
  },
  {
    name: "propose_create_job",
    description:
      "Propose creating a new ERC-8183 job as the client. This does NOT execute anything — it only shows the user a preview to confirm and sign in MetaMask. The description should already contain clear, checkable acceptance criteria you wrote. If this job is being created because someone claimed the user's open marketplace listing, pass listingId so the listing gets linked to the resulting on-chain job.",
    input_schema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Job description including explicit acceptance criteria." },
        provider: { type: "string", description: "Provider wallet address, 0x-prefixed." },
        evaluator: { type: "string", description: "Evaluator wallet address, 0x-prefixed." },
        listingId: { type: "integer", description: "Optional: the open-listing id this job fulfills, if any." },
      },
      required: ["description", "provider", "evaluator"],
    },
  },
  {
    name: "get_open_job_listings",
    description:
      "Browse the open job marketplace — jobs a client posted publicly with no assigned provider yet, that any wallet can claim. Use this when the user is looking for work / wants to find a job to do.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_my_job_listings",
    description:
      "Get the connected wallet's own posted marketplace listings (as client), including ones that have been claimed and are waiting for the on-chain job to be created.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "post_job_listing",
    description:
      "Post a job to the open marketplace as the client, with no assigned provider — any wallet can claim it. This has no gas cost and needs no wallet signature, so just do it (no confirmation preview) once you and the user agree on the description. Write clear, checkable acceptance criteria into the description, same as for propose_create_job.",
    input_schema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Job description including explicit acceptance criteria." },
        budget: { type: "string", description: "Optional suggested USDC budget, e.g. \"10.00\"." },
        evaluator: { type: "string", description: "Optional evaluator address; defaults to the connected wallet." },
      },
      required: ["description"],
    },
  },
  {
    name: "claim_job_listing",
    description:
      "Claim an open marketplace listing as its provider — no gas cost, no wallet signature needed, so just do it once the user confirms which listing. After claiming, the client still has to create and fund the real on-chain job before any work should start.",
    input_schema: {
      type: "object",
      properties: {
        listingId: { type: "integer", description: "The listing's id from get_open_job_listings." },
      },
      required: ["listingId"],
    },
  },
  {
    name: "propose_job_verdict",
    description:
      "Propose resolving a submitted job as its evaluator — approve (release escrow to the provider) or reject (refund the client). This does NOT execute anything — it only shows the user a preview to confirm and sign in MetaMask. Only call this when the submission clearly does or doesn't meet the job's criteria.",
    input_schema: {
      type: "object",
      properties: {
        jobId: { type: "string", description: "The job's on-chain id." },
        verdict: { type: "string", enum: ["approve", "reject"] },
        reason: { type: "string", description: "Specific reason citing the criteria met or missed." },
      },
      required: ["jobId", "verdict", "reason"],
    },
  },
  {
    name: "propose_send",
    description:
      "Propose sending (paying) a token to a recipient address. This does NOT execute anything — it only shows the user a preview to confirm and sign in MetaMask.",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient wallet address, 0x-prefixed." },
        token: { type: "string", enum: Object.keys(arc.tokens) },
        amount: { type: "string", description: 'Human-readable amount, e.g. "1.5".' },
      },
      required: ["to", "token", "amount"],
    },
  },
  {
    name: "propose_swap",
    description:
      "Propose swapping one token for another on Arc Testnet. This does NOT execute anything — it only shows the user a preview to confirm and sign in MetaMask.",
    input_schema: {
      type: "object",
      properties: {
        tokenIn: { type: "string", enum: Object.keys(arc.tokens) },
        tokenOut: { type: "string", enum: Object.keys(arc.tokens) },
        amountIn: { type: "string", description: 'Human-readable input amount, e.g. "10".' },
      },
      required: ["tokenIn", "tokenOut", "amountIn"],
    },
  },
  {
    name: "propose_stake",
    description:
      "Propose a staking action (stake, unstake, or claim rewards) on the ArcStaking contract. This does NOT execute anything — it only shows the user a preview to confirm and sign in MetaMask.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["stake", "unstake", "claim"] },
        token: { type: "string", enum: arc.staking.stakableTokens },
        amount: {
          type: "string",
          description: "Human-readable amount. Not needed for claim.",
        },
      },
      required: ["action", "token"],
    },
  },
  {
    name: "propose_bridge",
    description:
      "Propose bridging a token from one chain to another via Circle CCTP. This does NOT execute anything — it only shows the user a preview to confirm and sign in MetaMask.",
    input_schema: {
      type: "object",
      properties: {
        fromChain: { type: "string", enum: arc.bridge.supportedChains.map((c) => c.appKitName) },
        toChain: { type: "string", enum: arc.bridge.supportedChains.map((c) => c.appKitName) },
        token: { type: "string", enum: arc.bridge.tokens },
        amount: { type: "string", description: 'Human-readable amount, e.g. "5".' },
      },
      required: ["fromChain", "toChain", "token", "amount"],
    },
  },
];

async function executeTool(name, input, address) {
  switch (name) {
    case "get_config":
      return publicConfig();

    case "get_balances": {
      const entries = Object.values(arc.tokens).filter((t) => t.address && t.displayBalance);
      const balances = {};
      await Promise.all(
        entries.map(async (t) => {
          try {
            const raw = await publicClient.readContract({
              address: t.address,
              abi: balanceOfAbi,
              functionName: "balanceOf",
              args: [address],
            });
            balances[t.symbol] = { raw: raw.toString(), decimals: t.decimals };
          } catch (e) {
            balances[t.symbol] = { raw: "0", decimals: t.decimals, error: e.message };
          }
        })
      );
      return balances;
    }

    case "get_history": {
      const limit = Math.min(Math.max(Number(input?.limit) || 10, 1), 50);
      const addr = address.toLowerCase();
      const sends = db
        .prepare("SELECT * FROM sends WHERE address = ?")
        .all(addr)
        .map((s) => ({ type: "send", ...s }));
      const swaps = db
        .prepare("SELECT * FROM swaps WHERE address = ?")
        .all(addr)
        .map((s) => ({ type: "swap", ...s }));
      const stakes = db
        .prepare("SELECT * FROM stakes WHERE address = ?")
        .all(addr)
        .map((s) => ({ type: "stake", ...s }));
      const bridges = db
        .prepare("SELECT * FROM bridges WHERE address = ?")
        .all(addr)
        .map((b) => ({ type: "bridge", ...b }));
      return [...sends, ...swaps, ...stakes, ...bridges]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit);
    }

    case "get_staking_position": {
      const stakingAddress = getStakingAddress();
      if (!stakingAddress) return { error: "staking_not_deployed" };
      const tokenMeta = arc.tokens[input.token];
      if (!tokenMeta?.address) return { error: "unknown_token" };
      const [stakeInfo, pending] = await Promise.all([
        publicClient.readContract({
          address: stakingAddress,
          abi: stakingReadAbi,
          functionName: "stakeInfo",
          args: [address, tokenMeta.address],
        }),
        publicClient.readContract({
          address: stakingAddress,
          abi: stakingReadAbi,
          functionName: "pendingReward",
          args: [address, tokenMeta.address],
        }),
      ]);
      const staked = Array.isArray(stakeInfo) ? stakeInfo[0] : stakeInfo?.amount;
      return {
        token: input.token,
        stakedRaw: (staked ?? 0n).toString(),
        pendingRewardRaw: (pending ?? 0n).toString(),
        rewardToken: arc.staking.rewardToken,
        decimals: tokenMeta.decimals,
      };
    }

    case "get_job_details": {
      const addr = address.toLowerCase();
      const row = db.prepare("SELECT * FROM jobs WHERE jobId = ?").get(String(input.jobId));
      if (!row) return { error: "job_not_found" };
      if (![row.client, row.provider, row.evaluator].includes(addr)) {
        return { error: "not_a_party_to_this_job" };
      }
      return {
        jobId: row.jobId,
        description: row.description,
        status: row.status,
        budget: row.budget,
        client: row.client,
        provider: row.provider,
        evaluator: row.evaluator,
        deliverableText: row.deliverableText || null,
      };
    }

    case "get_open_job_listings": {
      const rows = db.prepare("SELECT * FROM job_listings WHERE status = 'open' ORDER BY createdAt DESC").all();
      return rows.map((l) => ({ id: l.id, client: l.client, description: l.description, budget: l.budget }));
    }

    case "get_my_job_listings": {
      const rows = db
        .prepare("SELECT * FROM job_listings WHERE client = ? ORDER BY updatedAt DESC")
        .all(address.toLowerCase());
      return rows.map((l) => ({
        id: l.id,
        description: l.description,
        budget: l.budget,
        evaluator: l.evaluator,
        status: l.status,
        claimedBy: l.claimedBy,
        jobId: l.jobId,
      }));
    }

    case "post_job_listing": {
      if (typeof input?.description !== "string" || !input.description.trim()) {
        return { error: "invalid_description" };
      }
      const evaluator = (input.evaluator || address).toLowerCase();
      const now = Date.now();
      const info = db
        .prepare(
          `INSERT INTO job_listings (client, description, budget, evaluator, status, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, 'open', ?, ?)`
        )
        .run(address.toLowerCase(), input.description.trim(), input.budget ? String(input.budget) : null, evaluator, now, now);
      return db.prepare("SELECT * FROM job_listings WHERE id = ?").get(info.lastInsertRowid);
    }

    case "claim_job_listing": {
      const id = Number(input?.listingId);
      if (!Number.isInteger(id) || id <= 0) return { error: "invalid_listingId" };
      const listing = db.prepare("SELECT * FROM job_listings WHERE id = ?").get(id);
      if (!listing) return { error: "listing_not_found" };
      const result = db
        .prepare("UPDATE job_listings SET status = 'claimed', claimedBy = ?, updatedAt = ? WHERE id = ? AND status = 'open'")
        .run(address.toLowerCase(), Date.now(), id);
      if (result.changes === 0) return { error: "already_claimed" };
      return db.prepare("SELECT * FROM job_listings WHERE id = ?").get(id);
    }

    case "get_agent_identity": {
      const identity = getAgentIdentity();
      if (!identity) return { registered: false };
      return {
        registered: true,
        agentId: identity.agentId,
        ownerWalletAddress: identity.ownerWalletAddress,
        metadataURI: identity.metadataURI,
        registerTxHash: identity.registerTxHash,
        registeredAt: identity.registeredAt,
        explorerUrl: `https://testnet.arcscan.app/tx/${identity.registerTxHash}`,
      };
    }

    default:
      throw new Error(`unknown_read_tool:${name}`);
  }
}

/**
 * Run one agent turn. `messages` is the full Anthropic-format conversation
 * (client-held — the backend keeps no chat session state). Returns either a
 * finished assistant reply, or a pending on-chain action the frontend must
 * render for confirmation before anything is signed. `onTextDelta`, if given,
 * is called with each chunk of assistant text as it streams in (across every
 * internal turn, including ones that end in a read-tool call).
 */
export async function runAgentTurn({ address, messages, onTextDelta }) {
  if (!env.anthropicApiKey) {
    const err = new Error("agent_not_configured");
    err.code = "agent_not_configured";
    throw err;
  }

  let convo = messages;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 2048,
      system: systemPrompt(address),
      tools: TOOLS,
      messages: convo,
    });
    if (onTextDelta) stream.on("text", onTextDelta);
    const response = await stream.finalMessage();

    // claude-opus-5 can return an unsolicited stub thinking block (empty
    // `thinking`/`signature`) ahead of tool_use even though we never request
    // extended thinking. Echoing it back verbatim fails Anthropic's
    // "each thinking block must contain thinking" validation, so drop it —
    // there's no reasoning content in it to preserve.
    const contentForHistory = response.content.filter(
      (b) => b.type !== "thinking" && b.type !== "redacted_thinking"
    );
    convo = [...convo, { role: "assistant", content: contentForHistory }];

    if (response.stop_reason !== "tool_use") {
      return { messages: convo, status: "final" };
    }

    const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
    const proposeBlock = toolUseBlocks.find((b) => b.name.startsWith(PROPOSE_PREFIX));
    if (proposeBlock) {
      return {
        messages: convo,
        status: "pending_action",
        pendingAction: {
          toolUseId: proposeBlock.id,
          name: proposeBlock.name,
          input: proposeBlock.input,
        },
      };
    }

    const toolResults = [];
    for (const block of toolUseBlocks) {
      try {
        const result = await executeTool(block.name, block.input, address);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      } catch (e) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: String(e?.message || e),
          is_error: true,
        });
      }
    }
    convo = [...convo, { role: "user", content: toolResults }];
  }

  convo = [
    ...convo,
    {
      role: "assistant",
      content: [
        { type: "text", text: "Sorry, I couldn't finish that — please try rephrasing your request." },
      ],
    },
  ];
  return { messages: convo, status: "final" };
}
