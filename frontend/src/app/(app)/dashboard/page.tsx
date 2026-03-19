"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, RefreshCw, Github, Wallet, Briefcase, CreditCard } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { TrustScoreRing } from "@/components/charts/trust-score-ring";
import { IncomeChart } from "@/components/charts/income-chart";
import { PageShell } from "@/components/layout/page-shell";
import { api } from "@/lib/api-client";
import type { TrustScoreResult } from "@/types";

const MOCK_INCOME = [
  { month: "JAN", confirmed: 3200, projected: 800 },
  { month: "FEB", confirmed: 2800, projected: 1200 },
  { month: "MAR", confirmed: 4100, projected: 600 },
  { month: "APR", confirmed: 3600, projected: 1800 },
  { month: "MAY", confirmed: 5200, projected: 2400 },
  { month: "JUN", confirmed: 4800, projected: 3200 },
];

const REPUTATION_ITEMS = [
  { label: "Identity Verification", value: "100% Verified", color: "text-emerald-400" },
  { label: "Income Stability", value: "High", color: "text-emerald-400" },
  { label: "Repayment History", value: "A+ (Perfect)", color: "text-emerald-400" },
  { label: "Portfolio Diversity", value: "Medium", color: "text-gray-300" },
];

const CONNECTED_PLATFORMS = [
  {
    icon: Github,
    name: "GitHub Developer Profile",
    synced: "2 hours ago",
    status: "Active",
    metric: "+125 Score",
    metricSub: "CONTRIBUTION PROOF",
    color: "bg-gray-700",
  },
  {
    icon: Briefcase,
    name: "Upwork Talent",
    synced: "1 day ago",
    status: "Active",
    metric: "$4,200/mo avg",
    metricSub: "REVENUE PROOF",
    color: "bg-amber-600",
  },
  {
    icon: CreditCard,
    name: "Stripe Business",
    synced: "4 hours ago",
    status: "Active",
    metric: "$12,850 Total Vol.",
    metricSub: "STABILITY PROOF",
    color: "bg-blue-600",
  },
  {
    icon: Wallet,
    name: "On-chain Wallet",
    synced: "Real-time",
    status: "Connected",
    metric: "2.4 ETH Balance",
    metricSub: "ASSET PROOF",
    color: "bg-amber-800",
  },
];

export default function DashboardPage() {
  const [trustScore, setTrustScore] = useState<TrustScoreResult | null>(null);
  const [loading, setLoading] = useState(false);

  const score = trustScore?.score ?? 782;
  const tier = trustScore?.risk_tier ?? "EXCELLENT";

  async function handleCalculate() {
    setLoading(true);
    try {
      const result = await api.trustScore.calculate();
      setTrustScore(result);
    } catch {
      // API not connected yet — keep demo values
    } finally {
      setLoading(false);
    }
  }

  const riskBarWidth =
    tier === "EXCELLENT" || tier === "GOOD"
      ? "w-1/4"
      : tier === "FAIR"
        ? "w-1/2"
        : "w-3/4";

  return (
    <PageShell title="Dashboard">
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* ── Left column ────────────────────────────── */}
        <div className="space-y-6">
          {/* Trust Score */}
          <Card className="flex flex-col items-center text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Your Trust Score
            </p>
            <div className="relative mt-4">
              <TrustScoreRing score={score} tier={tier} />
            </div>
            <p className="mt-4 text-xs text-gray-500">
              Calculated from 4 data sources and on-chain history
            </p>
            <button
              onClick={handleCalculate}
              disabled={loading}
              className="mt-3 flex items-center gap-1.5 text-xs text-brand hover:text-amber-400 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              Recalculate
            </button>
          </Card>

          {/* Reputation Breakdown */}
          <Card>
            <h3 className="font-semibold">Reputation Breakdown</h3>
            <div className="mt-4 space-y-3">
              {REPUTATION_ITEMS.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-gray-400">{item.label}</span>
                  <span className={`font-medium ${item.color}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-surface-border pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Risk Level</span>
                <StatusBadge
                  label="Low Risk"
                  variant="success"
                  dot={false}
                />
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-800">
                <div
                  className={`h-full rounded-full bg-emerald-500 transition-all ${riskBarWidth}`}
                />
              </div>
            </div>
          </Card>

          {/* CTAs */}
          <Link
            href="/loans/request"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-4 text-sm font-semibold text-gray-950 transition-colors hover:bg-amber-400"
          >
            Request Instant Loan <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/connections"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-surface-border py-4 text-sm font-semibold text-gray-300 transition-colors hover:bg-surface-light"
          >
            + Connect New Platform
          </Link>
        </div>

        {/* ── Right column ───────────────────────────── */}
        <div className="space-y-6">
          {/* Income Chart */}
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Monthly Income Stream
              </h3>
            </div>
            <IncomeChart data={MOCK_INCOME} />
          </Card>

          {/* Connected Platforms */}
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">Connected Platforms</h3>
              <span className="text-xs text-gray-500">
                {CONNECTED_PLATFORMS.length} Active Sources
              </span>
            </div>
            <div className="space-y-4">
              {CONNECTED_PLATFORMS.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between rounded-lg border border-surface-border bg-surface-light p-4"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${p.color}`}
                    >
                      <p.icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-gray-500">
                        Synced: {p.synced} &middot;{" "}
                        <span className="text-emerald-400">{p.status}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{p.metric}</p>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">
                      {p.metricSub}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <button className="mt-4 w-full text-center text-xs font-semibold uppercase tracking-wider text-brand hover:text-amber-400 transition-colors">
              View All Data Points
            </button>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
