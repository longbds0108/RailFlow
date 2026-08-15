// AI transaction agent: Claude (tool use) proposes Payment/Swap/Staking/Bridge
// actions; it never executes them. Read tools run here (public RPC + DB, no
// signing). Any propose_* tool call ends the turn immediately and is handed
// back to the frontend as a pending action — the user still reviews and signs
// every transaction in MetaMask, exactly like the manual forms.
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

function systemPrompt() {
  const cfg = publicConfig();
  const tokens = Object.keys(cfg.tokens).join(", ");
  const pairs = cfg.swap.pairs.map((p) => p.join("/")).join(", ");
  const chains = cfg.bridge.supportedChains.map((c) => c.label).join(", ");

  return `You are the RailFlow Assistant, built into a self-custody testnet dApp on Arc Testnet (Circle's chain).

Core rule: you never hold or use a private key, and you never execute a transaction yourself. When the user wants to send, swap, stake, or bridge, call the matching propose_* tool with the exact parameters — the app then shows the user a preview and they confirm and sign it themselves in MetaMask. Never claim a transaction succeeded, failed, or has a hash unless a tool result told you so.

Network: ${cfg.network.name} (chainId ${cfg.network.chainId}).
Tokens: ${tokens}.
Swap pairs: ${pairs}. Default slippage: ${cfg.swap.defaultSlippageBps} bps.
Staking: reward token ${cfg.staking.rewardToken}, APY ${(cfg.staking.apyBps / 100).toFixed(2)}%, min stake ${cfg.staking.minStake} ${(cfg.staking.stakableTokens || []).join("/")}.
Bridge chains: ${chains} (token: ${cfg.bridge.tokens.join(", ")}).

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

async function executeReadTool(name, input, address) {
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
      system: systemPrompt(),
      tools: TOOLS,
      messages: convo,
    });
    if (onTextDelta) stream.on("text", onTextDelta);
    const response = await stream.finalMessage();

    convo = [...convo, { role: "assistant", content: response.content }];

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
        const result = await executeReadTool(block.name, block.input, address);
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
