"use client";

import { RISK_TIER_COLORS, RISK_TIER_LABELS } from "@/lib/constants";

interface TrustScoreRingProps {
  score: number;
  maxScore?: number;
  tier: string;
  size?: number;
}

export function TrustScoreRing({
  score,
  maxScore = 1000,
  tier,
  size = 160,
}: TrustScoreRingProps) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(score / maxScore, 1);
  const offset = circumference * (1 - pct);

  const tierColor = RISK_TIER_COLORS[tier] ?? "text-gray-400";
  const tierLabel = RISK_TIER_LABELS[tier] ?? tier;

  const strokeColor =
    tier === "EXCELLENT" || tier === "GOOD"
      ? "#22c55e"
      : tier === "FAIR"
        ? "#f59e0b"
        : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1f2937"
          strokeWidth={10}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={10}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div
        className="absolute flex flex-col items-center"
        style={{ width: size, height: size, justifyContent: "center" }}
      >
        <span className="text-4xl font-bold">{score}</span>
        <span className={`text-sm font-semibold uppercase ${tierColor}`}>
          {tierLabel}
        </span>
      </div>
    </div>
  );
}
