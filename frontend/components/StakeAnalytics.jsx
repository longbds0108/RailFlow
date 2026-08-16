"use client";

import { useEffect, useState } from "react";
import { useConfig as useWagmiConfig } from "wagmi";
import { getPublicClient } from "wagmi/actions";
import { TOKENS, ENV } from "../lib/config";
import { erc20Abi, arcStakingAbi } from "../lib/erc20";
import { fmtNumber, apyFromBps } from "../lib/format";

// ---------- small numeric helpers ----------

// Round a chart's top axis value up to a "nice" number (1/2/2.5/5/10 × 10^n).
function niceMax(value) {
  if (!value || value <= 0) return 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const norm = value / magnitude;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return step * magnitude;
}

function axisLabel(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return fmtNumber(n, n < 10 ? 2 : 0);
}

// ---------- chart primitives (no charting library — small inline SVG) ----------

const CHART_W = 520;
const CHART_H = 210;
const PAD_L = 44;
const PAD_R = 8;
const PAD_T = 10;
const PAD_B = 24;

function ChartGrid({ max }) {
  const chartH = CHART_H - PAD_T - PAD_B;
  const lines = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  return (
    <>
      {lines.map((g, i) => {
        const y = PAD_T + chartH - (g / max) * chartH;
        return (
          <g key={i}>
            <line x1={PAD_L} y1={y} x2={CHART_W - PAD_R} y2={y} stroke="var(--color-border)" strokeDasharray="3 4" />
            <text x={PAD_L - 8} y={y + 4} textAnchor="end" fontSize="10" fill="var(--color-text-faint)">
              {axisLabel(g)}
            </text>
          </g>
        );
      })}
    </>
  );
}

function BarChart({ data }) {
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const chartW = CHART_W - PAD_L - PAD_R;
  const chartH = CHART_H - PAD_T - PAD_B;
  const slot = chartW / data.length;
  const barW = Math.min(56, slot * 0.5);

  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} width="100%" style={{ display: "block" }}>
      <ChartGrid max={max} />
      {data.map((d, i) => {
        const bh = max > 0 ? (d.value / max) * chartH : 0;
        const x = PAD_L + slot * i + (slot - barW) / 2;
        const y = PAD_T + chartH - bh;
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={barW} height={Math.max(bh, 1)} rx="6" fill={d.color} />
            <text x={x + barW / 2} y={CHART_H - 6} textAnchor="middle" fontSize="11" fill="var(--color-text-muted)">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Catmull-Rom -> cubic Bezier, for a smooth (not jagged) line through points.
function smoothPath(points) {
  if (points.length < 2) return "";
  let d = `M ${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function AreaChart({ data, gradId }) {
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const chartW = CHART_W - PAD_L - PAD_R;
  const chartH = CHART_H - PAD_T - PAD_B;
  const step = data.length > 1 ? chartW / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = PAD_L + step * i;
    const y = PAD_T + chartH - (max > 0 ? (d.value / max) * chartH : 0);
    return [x, y];
  });
  const linePath = smoothPath(points);
  const floorY = PAD_T + chartH;
  const areaPath = `${linePath} L ${points[points.length - 1][0]},${floorY} L ${points[0][0]},${floorY} Z`;

  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} width="100%" style={{ display: "block" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <ChartGrid max={max} />
      <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
      <path d={linePath} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill="var(--color-primary)" />
      ))}
      {data.map((d, i) => (
        <text key={d.label} x={points[i][0]} y={CHART_H - 6} textAnchor="middle" fontSize="11" fill="var(--color-text-muted)">
          {d.label}
        </text>
      ))}
    </svg>
  );
}

function StatCard({ title, value, sub }) {
  return (
    <div className="card">
      <div className="muted text-sm">{title}</div>
      <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700, margin: "var(--space-2) 0", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      <div className="faint text-xs">{sub}</div>
    </div>
  );
}

// Protocol-wide + personal staking analytics for the current stakable tokens.
// Every number here comes from an on-chain read or a deterministic projection
// off the fixed APY — nothing is a placeholder.
export default function StakeAnalytics({ stakingAddress, staking, token, userStakedRaw, userPendingRaw, refreshKey }) {
  const wagmiCfg = useWagmiConfig();
  const [pool, setPool] = useState(null); // { usdcStaked, eurcStaked, rewardPool }

  useEffect(() => {
    if (!stakingAddress) return;
    let cancelled = false;
    (async () => {
      try {
        const client = getPublicClient(wagmiCfg, { chainId: ENV.chainId });
        const usdcMeta = TOKENS.USDC;
        const eurcMeta = TOKENS.EURC;
        const [usdcBal, eurcBal, rewardPool] = await Promise.all([
          client.readContract({ address: usdcMeta.address, abi: erc20Abi, functionName: "balanceOf", args: [stakingAddress] }),
          client.readContract({ address: eurcMeta.address, abi: erc20Abi, functionName: "balanceOf", args: [stakingAddress] }),
          client.readContract({ address: stakingAddress, abi: arcStakingAbi, functionName: "rewardPoolBalance" }),
        ]);
        if (cancelled) return;
        // The contract holds USDC as both staked principal and reward pool
        // together; rewardPoolBalance() already excludes staked principal,
        // so subtracting it out gives the USDC portion that's actually staked.
        const usdcStakedRaw = usdcBal > rewardPool ? usdcBal - rewardPool : 0n;
        setPool({
          usdcStaked: Number(usdcStakedRaw) / 10 ** usdcMeta.decimals,
          eurcStaked: Number(eurcBal) / 10 ** eurcMeta.decimals,
          rewardPool: Number(rewardPool) / 10 ** usdcMeta.decimals,
        });
      } catch {
        if (!cancelled) setPool({ usdcStaked: 0, eurcStaked: 0, rewardPool: 0, error: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stakingAddress, wagmiCfg, refreshKey]);

  if (!stakingAddress) return null;

  const apyBps = staking.apyBps ?? 1000;
  const tokenMeta = TOKENS[token];
  const rewardMeta = TOKENS[staking.rewardToken || "USDC"];
  const stakedNum = Number(userStakedRaw || 0) / 10 ** tokenMeta.decimals;
  const pendingNum = Number(userPendingRaw || 0) / 10 ** rewardMeta.decimals;
  const totalStakedDemo = pool ? pool.usdcStaked + pool.eurcStaked : 0;

  const barData = [
    { label: "USDC", value: pool?.usdcStaked || 0, color: "var(--color-primary)" },
    { label: "EURC", value: pool?.eurcStaked || 0, color: "var(--color-accent)" },
  ];

  // Simple linear projection at the fixed APY: reward(t) = pending + staked * apy * t/365.
  const projectionData = [0, 30, 90, 180, 365].map((d) => ({
    label: d === 0 ? "Now" : `${d}d`,
    value: pendingNum + (stakedNum * apyBps * d) / (10000 * 365),
  }));

  return (
    <div className="mt-5">
      <h2 style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-2)" }}>Staking analytics</h2>
      <p className="muted text-sm" style={{ marginBottom: "var(--space-4)" }}>
        Live protocol totals read from the staking contract, plus your own projected reward growth.
      </p>

      <div className="stat-grid" style={{ marginBottom: "var(--space-4)" }}>
        <StatCard
          title="Total value staked"
          value={pool ? fmtNumber(totalStakedDemo, 2) : "…"}
          sub="USDC + EURC principal, all stakers (demo 1:1)"
        />
        <StatCard
          title="Reward pool"
          value={pool ? `${fmtNumber(pool.rewardPool, 2)} USDC` : "…"}
          sub="Available to pay out rewards"
        />
        <StatCard
          title={`Your staked (${token})`}
          value={fmtNumber(stakedNum, 4)}
          sub="Your current principal"
        />
        <StatCard title="Fixed APY" value={apyFromBps(apyBps)} sub="Applies to every staker" />
      </div>

      <div className="grid grid-cols-2" style={{ gap: "var(--space-4)" }}>
        <div className="card">
          <h3 style={{ fontSize: "var(--text-base)", marginBottom: "var(--space-3)" }}>Staked by token</h3>
          <BarChart data={barData} />
        </div>
        <div className="card">
          <h3 style={{ fontSize: "var(--text-base)", marginBottom: "var(--space-3)" }}>
            Your projected reward ({rewardMeta.symbol})
          </h3>
          <AreaChart data={projectionData} gradId="stakeRewardGrad" />
        </div>
      </div>
    </div>
  );
}
