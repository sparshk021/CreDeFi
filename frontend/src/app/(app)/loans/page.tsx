"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, TrendingUp, Heart, Award, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { PageShell } from "@/components/layout/page-shell";
import { api } from "@/lib/api-client";
import type { LoanRequest } from "@/types";

interface LoanCardData {
  id: string;
  borrowerInitials: string;
  borrowerName: string;
  borrowerBusiness: string;
  riskTier: string;
  trustScore: number;
  roi: number;
  amount: number;
  currency: string;
  duration: number;
  funded: number;
  incomeSources: string[];
}

const DEMO_LOANS: LoanCardData[] = [
  {
    id: "1",
    borrowerInitials: "NL",
    borrowerName: "Nexus Labs",
    borrowerBusiness: "Software Development",
    riskTier: "LOW",
    trustScore: 98,
    roi: 12.5,
    amount: 75000,
    currency: "USDT",
    duration: 6,
    funded: 65,
    incomeSources: ["INV", "RE"],
  },
  {
    id: "2",
    borrowerInitials: "SS",
    borrowerName: "SolarStream",
    borrowerBusiness: "Clean Energy",
    riskTier: "MEDIUM",
    trustScore: 84,
    roi: 18.2,
    amount: 120000,
    currency: "USDT",
    duration: 12,
    funded: 22,
    incomeSources: ["SUB"],
  },
  {
    id: "3",
    borrowerInitials: "QT",
    borrowerName: "Quantum Trade",
    borrowerBusiness: "Algorithmic Trading",
    riskTier: "HIGH",
    trustScore: 62,
    roi: 26.5,
    amount: 250000,
    currency: "USDT",
    duration: 18,
    funded: 88,
    incomeSources: ["GOV", "REV"],
  },
  {
    id: "4",
    borrowerInitials: "BP",
    borrowerName: "BlockPace",
    borrowerBusiness: "Infrastructure",
    riskTier: "LOW",
    trustScore: 92,
    roi: 11.8,
    amount: 40000,
    currency: "USDT",
    duration: 3,
    funded: 45,
    incomeSources: ["INV"],
  },
  {
    id: "5",
    borrowerInitials: "AP",
    borrowerName: "Aether Protocol",
    borrowerBusiness: "DeFi Yield",
    riskTier: "MEDIUM",
    trustScore: 89,
    roi: 15.4,
    amount: 100000,
    currency: "USDT",
    duration: 9,
    funded: 15,
    incomeSources: ["SUB"],
  },
  {
    id: "6",
    borrowerInitials: "EV",
    borrowerName: "Eos Ventures",
    borrowerBusiness: "Venture Capital",
    riskTier: "LOW",
    trustScore: 95,
    roi: 10.2,
    amount: 20000,
    currency: "USDT",
    duration: 4,
    funded: 95,
    incomeSources: ["REV"],
  },
];

const RECENT_TXS = [
  { id: "#TX-99201", borrower: "Julian Dasher", sub: "Logistics Loan", type: "INVESTMENT", amount: "5,000.00 USDC", date: "Oct 24, 2023", status: "Confirmed" },
  { id: "#TX-99188", borrower: "Urban Dev Group", sub: "Real Estate Yield", type: "INTEREST PAYMENT", amount: "+ 412.50 USDC", date: "Oct 22, 2023", status: "Confirmed" },
  { id: "#TX-99042", borrower: "Platform Wallet", sub: "Main Account", type: "DEPOSIT", amount: "10,000.00 USDC", date: "Oct 18, 2023", status: "Confirmed" },
];

function riskBadge(tier: string) {
  switch (tier) {
    case "LOW":
      return <StatusBadge label="Low Risk" variant="success" dot={false} />;
    case "MEDIUM":
      return <StatusBadge label="Medium Risk" variant="warning" dot={false} />;
    case "HIGH":
      return <StatusBadge label="High Risk" variant="error" dot={false} />;
    default:
      return <StatusBadge label={tier} variant="neutral" dot={false} />;
  }
}

function initialsColor(tier: string) {
  switch (tier) {
    case "LOW":
      return "bg-emerald-600";
    case "MEDIUM":
      return "bg-amber-600";
    case "HIGH":
      return "bg-red-600";
    default:
      return "bg-gray-600";
  }
}

function typeBadge(type: string) {
  switch (type) {
    case "INVESTMENT":
      return <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-400">{type}</span>;
    case "INTEREST PAYMENT":
      return <span className="rounded bg-brand/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand">{type}</span>;
    case "DEPOSIT":
      return <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-400">{type}</span>;
    default:
      return <span className="rounded bg-gray-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-400">{type}</span>;
  }
}

export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [loans, setLoans] = useState<LoanCardData[]>(DEMO_LOANS);

  useEffect(() => {
    api.loans.marketplace().then(() => {}).catch(() => {});
  }, []);

  const filtered = loans.filter(
    (l) =>
      l.borrowerName.toLowerCase().includes(search.toLowerCase()) ||
      l.borrowerBusiness.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageShell title="Marketplace" subtitle="Discover high-yield lending opportunities backed by verified collateral.">
      {/* Stats Row */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Active TVL" value="$4.2M" icon={<TrendingUp className="h-5 w-5" />} sub="+12.4%" />
        <StatCard label="Average ROI" value="14.2%" icon={<Heart className="h-5 w-5" />} />
        <StatCard label="Loans Funded" value="1,284" icon={<Award className="h-5 w-5" />} />
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold">Open Loan Opportunities</h2>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search borrowers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-surface-border bg-gray-950 py-2 pl-9 pr-4 text-sm text-white outline-none placeholder:text-gray-600 focus:border-brand"
            />
          </div>
          <button className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-2 text-sm text-gray-400 transition-colors hover:text-white">
            <SlidersHorizontal className="h-4 w-4" /> Filters
          </button>
        </div>
      </div>

      {/* Loan Cards Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((loan) => (
          <Card key={loan.id} className="flex flex-col justify-between">
            {/* Header */}
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white ${initialsColor(loan.riskTier)}`}>
                    {loan.borrowerInitials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{loan.borrowerName}</p>
                    <p className="text-xs text-gray-500">{loan.borrowerBusiness}</p>
                  </div>
                </div>
                {riskBadge(loan.riskTier)}
              </div>

              {/* Metrics */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-600">ROI%</p>
                  <p className="text-lg font-bold text-emerald-400">{loan.roi}%</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-600">Duration</p>
                  <p className="text-lg font-bold">{loan.duration} Months</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-gray-500">Trust Score</span>
                <span className="font-semibold">{loan.trustScore}/100</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${loan.trustScore}%` }}
                />
              </div>

              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-gray-500">Loan Amount</span>
                <span className="font-semibold">${loan.amount.toLocaleString()} {loan.currency}</span>
              </div>

              {/* Funding Progress */}
              <div className="mt-3">
                <ProgressBar value={loan.funded} color="bg-brand" />
                <div className="mt-1.5 flex items-center justify-between text-xs text-gray-500">
                  <span>${((loan.amount * loan.funded) / 100).toLocaleString()} Raised</span>
                  <span>{loan.funded}%</span>
                </div>
              </div>
            </div>

            <Link
              href={`/loans/${loan.id}`}
              className="mt-5 flex w-full items-center justify-center rounded-xl bg-brand py-3 text-sm font-semibold text-gray-950 transition-colors hover:bg-amber-400"
            >
              FUND LOAN
            </Link>
          </Card>
        ))}
      </div>

      {/* Recent Transactions */}
      <Card className="mt-10" padding={false}>
        <div className="flex items-center justify-between border-b border-surface-border px-6 py-4">
          <h3 className="font-semibold">Recent Transactions</h3>
          <button className="flex items-center gap-1.5 text-sm font-semibold text-brand transition-colors hover:text-amber-400">
            <Download className="h-4 w-4" /> Download CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-surface-border text-xs uppercase tracking-wider text-gray-500">
                <th className="px-6 py-3 font-medium">Transaction ID</th>
                <th className="px-6 py-3 font-medium">Asset / Borrower</th>
                <th className="px-6 py-3 font-medium">Type</th>
                <th className="px-6 py-3 font-medium">Amount</th>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_TXS.map((tx) => (
                <tr key={tx.id} className="border-b border-surface-border/50 transition-colors hover:bg-surface-light">
                  <td className="px-6 py-4 font-mono text-gray-400">{tx.id}</td>
                  <td className="px-6 py-4">
                    <p className="font-medium">{tx.borrower}</p>
                    <p className="text-xs text-gray-500">{tx.sub}</p>
                  </td>
                  <td className="px-6 py-4">{typeBadge(tx.type)}</td>
                  <td className="px-6 py-4 font-medium">{tx.amount}</td>
                  <td className="px-6 py-4 text-gray-400">{tx.date}</td>
                  <td className="px-6 py-4">
                    <span className="text-emerald-400">&bull; {tx.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </PageShell>
  );
}
