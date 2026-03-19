"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageShell } from "@/components/layout/page-shell";
import { api } from "@/lib/api-client";

const DURATION_PRESETS = [30, 90, 180, 365];

const BORROW_ASSETS = ["USDC (USD Coin)", "ETH (Ethereum)", "DAI (Dai)"];
const COLLATERAL_ASSETS = ["ETH (Ethereum)", "WBTC (Wrapped Bitcoin)", "USDC (USD Coin)"];

export default function LoanRequestPage() {
  const router = useRouter();
  const [borrowAsset, setBorrowAsset] = useState(BORROW_ASSETS[0]);
  const [collateralAsset, setCollateralAsset] = useState(COLLATERAL_ASSETS[0]);
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState(30);
  const [collateralRatio, setCollateralRatio] = useState(150);
  const [submitting, setSubmitting] = useState(false);

  const parsedAmount = parseFloat(amount) || 0;
  const estimatedInterest = (parsedAmount * 0.0425 * duration) / 365;
  const liquidationPrice = parsedAmount > 0 ? (parsedAmount * 1.2) / (collateralRatio / 100) : 0;

  async function handleSubmit() {
    if (parsedAmount <= 0) return;
    setSubmitting(true);
    try {
      const result = await api.loans.create({
        amount: parsedAmount,
        currency: borrowAsset.split(" ")[0],
        duration_days: duration,
      });
      router.push(`/loans/${result.id}`);
    } catch {
      // API may not be connected
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell
      title="Request Smart Loan"
      subtitle="Our AI engine analyzes real-time market data to provide the best possible rates and limits."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* ── Form ──────────────────────────── */}
        <Card>
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Borrow Asset */}
            <div>
              <label className="text-sm font-medium text-gray-400">
                Borrow Asset
              </label>
              <select
                value={borrowAsset}
                onChange={(e) => setBorrowAsset(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-surface-border bg-gray-950 px-4 py-3 text-sm text-white outline-none focus:border-brand"
              >
                {BORROW_ASSETS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </div>

            {/* Collateral Asset */}
            <div>
              <label className="text-sm font-medium text-gray-400">
                Collateral Asset
              </label>
              <select
                value={collateralAsset}
                onChange={(e) => setCollateralAsset(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-surface-border bg-gray-950 px-4 py-3 text-sm text-white outline-none focus:border-brand"
              >
                {COLLATERAL_ASSETS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </div>

            {/* Loan Amount */}
            <div>
              <label className="text-sm font-medium text-gray-400">
                Loan Amount
              </label>
              <div className="relative mt-1.5">
                <input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg border border-surface-border bg-gray-950 px-4 py-3 pr-16 text-sm text-white outline-none focus:border-brand"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500">
                  {borrowAsset.split(" ")[0]}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs text-gray-600">
                <span>AI Limit: 50,000 {borrowAsset.split(" ")[0]}</span>
                <button className="text-brand hover:text-amber-400 transition-colors">
                  Max Amount
                </button>
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="text-sm font-medium text-gray-400">
                Duration
              </label>
              <div className="relative mt-1.5">
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full rounded-lg border border-surface-border bg-gray-950 px-4 py-3 pr-16 text-sm text-white outline-none focus:border-brand"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500">
                  Days
                </span>
              </div>
              <div className="mt-2 flex gap-2">
                {DURATION_PRESETS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      duration === d
                        ? "bg-brand text-gray-950"
                        : "bg-surface-light text-gray-400 hover:text-white"
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Collateral Ratio Slider */}
          <div className="mt-8">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-400">
                Collateral Ratio
              </span>
              <span className="text-lg font-bold text-brand">
                {collateralRatio}%
              </span>
            </div>
            <input
              type="range"
              min={110}
              max={300}
              step={5}
              value={collateralRatio}
              onChange={(e) => setCollateralRatio(Number(e.target.value))}
              className="mt-3 w-full accent-brand"
            />
            <div className="mt-1 flex justify-between text-[10px] text-gray-600">
              <span>RISKY (110%)</span>
              <span className="text-brand">AI SUGGESTED (150%)</span>
              <span>SAFE (300%)</span>
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={parsedAmount <= 0 || submitting}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-4 text-sm font-semibold text-gray-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
          >
            {submitting ? "Processing..." : "Initiate Smart Loan"}{" "}
            <ArrowRight className="h-4 w-4" />
          </button>

          {/* Estimated Metrics */}
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-surface-border bg-surface-light p-4">
              <p className="text-xs text-gray-500">Estimated Interest</p>
              <p className="mt-1 text-lg font-bold">
                4.25% <span className="text-xs font-normal text-emerald-400">APR</span>
              </p>
            </div>
            <div className="rounded-xl border border-surface-border bg-surface-light p-4">
              <p className="text-xs text-gray-500">Liquidation Price</p>
              <p className="mt-1 text-lg font-bold">
                ${liquidationPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                <span className="text-xs font-normal text-gray-400">ETH</span>
              </p>
            </div>
            <div className="rounded-xl border border-surface-border bg-surface-light p-4">
              <p className="text-xs text-gray-500">Protocol Fee</p>
              <p className="mt-1 text-lg font-bold">
                0.05<span className="text-xs font-normal text-gray-400">%</span>
              </p>
            </div>
          </div>
        </Card>

        {/* ── Right sidebar ─────────────────── */}
        <div className="space-y-6">
          {/* AI Insights */}
          <Card>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-brand" />
              <h3 className="font-semibold">AI Insights</h3>
            </div>

            <div className="mt-4">
              <h4 className="text-sm font-semibold">Recommended Limit</h4>
              <p className="mt-1 text-sm leading-relaxed text-gray-500">
                Based on your wallet history and current collateral volatility,
                our AI suggests a limit of{" "}
                <span className="font-semibold text-brand">50,000 USDC</span>{" "}
                to maintain a healthy safety score.
              </p>
            </div>

            <div className="mt-5">
              <h4 className="text-sm font-semibold">Collateral Strategy</h4>
              <p className="mt-1 text-sm leading-relaxed text-gray-500">
                A <span className="font-semibold text-brand">150% ratio</span>{" "}
                is recommended due to an expected 5% volatility in ETH over the
                next 14 days. This minimizes liquidation risk while maximizing
                capital efficiency.
              </p>
            </div>

            <div className="mt-5 rounded-lg border border-surface-border bg-surface-light p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Safety Score</span>
                <span className="font-semibold text-emerald-400">8.4 / 10</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-800">
                <div className="h-full w-[84%] rounded-full bg-emerald-500" />
              </div>
            </div>

            <p className="mt-4 text-[10px] text-gray-600">
              * Rates are refreshed every 60 seconds based on decentralized
              oracle feeds.
            </p>
          </Card>

          {/* Market Pulse */}
          <Card>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Market Pulse
            </h3>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">ETH Price</span>
                <span className="font-medium">
                  $2,451.20{" "}
                  <span className="text-xs text-emerald-400">+1.2%</span>
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Network Congestion</span>
                <span className="font-medium text-emerald-400">LOW</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Gas Price</span>
                <span className="font-medium">
                  18 <span className="text-xs text-gray-500">Gwei</span>
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
