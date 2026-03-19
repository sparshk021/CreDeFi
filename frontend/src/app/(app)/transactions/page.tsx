"use client";

import { useState } from "react";
import { Download, RefreshCw, ExternalLink, TrendingUp, ShieldCheck, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageShell } from "@/components/layout/page-shell";

const TABS = ["All Activities", "Loans", "Repayments", "Connections", "Lending"];

interface TxRow {
  date: string;
  time: string;
  type: string;
  typeIcon: string;
  asset: string;
  assetSub: string;
  status: "Confirmed" | "Pending" | "Failed";
  txHash: string;
}

const DEMO_TXS: TxRow[] = [
  {
    date: "Oct 24, 2023",
    time: "14:32:01 UTC",
    type: "Lending Deposit",
    typeIcon: "deposit",
    asset: "2,500.00 USDC",
    assetSub: "Value: $2,500.00",
    status: "Confirmed",
    txHash: "0x7f...e3a9",
  },
  {
    date: "Oct 23, 2023",
    time: "09:15:44 UTC",
    type: "Loan Request",
    typeIcon: "loan",
    asset: "0.45 ETH",
    assetSub: "Value: $1,120.40",
    status: "Pending",
    txHash: "0x9a...b2c1",
  },
  {
    date: "Oct 22, 2023",
    time: "22:04:12 UTC",
    type: "Platform Connected",
    typeIcon: "connection",
    asset: "MetaMask",
    assetSub: "Browser Extension",
    status: "Confirmed",
    txHash: "0x1d...8f5e",
  },
  {
    date: "Oct 20, 2023",
    time: "18:11:59 UTC",
    type: "Repayment",
    typeIcon: "repayment",
    asset: "1,200.00 DAI",
    assetSub: "Value: $1,200.00",
    status: "Failed",
    txHash: "0x4c...a721",
  },
];

function statusVariant(s: TxRow["status"]) {
  switch (s) {
    case "Confirmed":
      return "success" as const;
    case "Pending":
      return "warning" as const;
    case "Failed":
      return "error" as const;
  }
}

function typeIconBg(icon: string) {
  switch (icon) {
    case "deposit":
      return "bg-emerald-500/20 text-emerald-400";
    case "loan":
      return "bg-brand/20 text-brand";
    case "connection":
      return "bg-blue-500/20 text-blue-400";
    case "repayment":
      return "bg-red-500/20 text-red-400";
    default:
      return "bg-gray-500/20 text-gray-400";
  }
}

export default function TransactionsPage() {
  const [activeTab, setActiveTab] = useState("All Activities");
  const [page, setPage] = useState(1);
  const totalItems = 128;
  const perPage = 10;
  const totalPages = Math.ceil(totalItems / perPage);

  return (
    <PageShell
      title="Transaction History"
      subtitle="View and manage your protocol activities across the DeFi ecosystem."
      actions={
        <>
          <button className="flex items-center gap-2 rounded-lg border border-surface-border px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-surface-light">
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-gray-950 transition-colors hover:bg-amber-400">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </>
      }
    >
      {/* Tabs */}
      <Card padding={false}>
        <div className="flex gap-1 border-b border-surface-border px-6 pt-4">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "border-b-2 border-brand text-brand"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab}
              {tab === "All Activities" && (
                <span className="ml-1.5 rounded-full bg-brand/20 px-2 py-0.5 text-xs text-brand">
                  {totalItems}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-surface-border text-xs uppercase tracking-wider text-gray-500">
                <th className="px-6 py-3 font-medium">Date / Time</th>
                <th className="px-6 py-3 font-medium">Transaction Type</th>
                <th className="px-6 py-3 font-medium">Asset / Amount</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">TX Hash</th>
                <th className="px-6 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_TXS.map((tx, i) => (
                <tr
                  key={i}
                  className="border-b border-surface-border/50 transition-colors hover:bg-surface-light"
                >
                  <td className="px-6 py-4">
                    <p className="font-medium">{tx.date}</p>
                    <p className="text-xs text-gray-500">{tx.time}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${typeIconBg(tx.typeIcon)}`}
                      >
                        <span className="text-xs font-bold">
                          {tx.typeIcon[0].toUpperCase()}
                        </span>
                      </span>
                      <span className="font-medium">{tx.type}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold">{tx.asset}</p>
                    <p className="text-xs text-gray-500">{tx.assetSub}</p>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge label={tx.status} variant={statusVariant(tx.status)} />
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-gray-400">
                    {tx.txHash}
                  </td>
                  <td className="px-6 py-4">
                    <button className="text-gray-500 transition-colors hover:text-white">
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-surface-border px-6 py-4">
          <p className="text-sm text-gray-500">
            Showing <span className="font-medium text-white">1-{perPage}</span>{" "}
            of <span className="font-medium text-white">{totalItems}</span>{" "}
            transactions
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-400 transition-colors hover:bg-surface-light disabled:opacity-30"
            >
              &lsaquo;
            </button>
            {[1, 2, 3].map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  page === p
                    ? "bg-brand text-gray-950"
                    : "text-gray-400 hover:bg-surface-light"
                }`}
              >
                {p}
              </button>
            ))}
            <span className="px-1 text-gray-600">...</span>
            <button
              onClick={() => setPage(totalPages)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                page === totalPages
                  ? "bg-brand text-gray-950"
                  : "text-gray-400 hover:bg-surface-light"
              }`}
            >
              {totalPages}
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-400 transition-colors hover:bg-surface-light disabled:opacity-30"
            >
              &rsaquo;
            </button>
          </div>
        </div>
      </Card>

      {/* Summary Stats */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Volume"
          value="$24,982.50"
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          label="Success Rate"
          value="98.4%"
          icon={<ShieldCheck className="h-5 w-5" />}
        />
        <StatCard
          label="Avg. Confirmation"
          value="~12s"
          icon={<Clock className="h-5 w-5" />}
        />
      </div>
    </PageShell>
  );
}
