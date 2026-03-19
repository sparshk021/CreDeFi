"use client";

import { useState } from "react";
import { Github, Briefcase, CreditCard, Wallet, Linkedin, Plus, Shield } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageShell } from "@/components/layout/page-shell";

type PlatformStatus = "connected" | "not_connected" | "expiring";

interface Platform {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  description: string;
  status: PlatformStatus;
  detail?: string;
  actionLabel: string;
}

const PLATFORMS: Platform[] = [
  {
    id: "github",
    icon: Github,
    name: "GitHub",
    description:
      "Verify your contributions, repository ownership, and developer activity metrics.",
    status: "connected",
    detail: "Last Sync: 2 hours ago",
    actionLabel: "Refresh Data",
  },
  {
    id: "freelance",
    icon: Briefcase,
    name: "Freelance Platforms",
    description:
      "Connect Upwork, Fiverr, or Toptal to verify earnings and project completion history.",
    status: "not_connected",
    actionLabel: "Connect Upwork",
  },
  {
    id: "payment",
    icon: CreditCard,
    name: "Payment Processors",
    description:
      "Link Stripe, PayPal, or Wise to prove cash flow and payment reliability.",
    status: "not_connected",
    actionLabel: "Connect Stripe",
  },
  {
    id: "wallet",
    icon: Wallet,
    name: "Web3 Wallets",
    description:
      "Connect MetaMask, Phantom, or Coinbase Wallet to verify on-chain assets and history.",
    status: "connected",
    detail: "0x71C...4921",
    actionLabel: "Add Another Wallet",
  },
  {
    id: "linkedin",
    icon: Linkedin,
    name: "LinkedIn",
    description:
      "Sync your professional network and employment history to enhance social trust.",
    status: "expiring",
    actionLabel: "Renew Access",
  },
];

function statusBadge(s: PlatformStatus) {
  switch (s) {
    case "connected":
      return <StatusBadge label="Connected" variant="success" />;
    case "expiring":
      return <StatusBadge label="Expiring" variant="warning" />;
    default:
      return <StatusBadge label="Not Connected" variant="neutral" />;
  }
}

function actionColor(s: PlatformStatus) {
  if (s === "connected") {
    return "border border-surface-border text-gray-300 hover:bg-surface-light";
  }
  return "bg-brand text-gray-950 hover:bg-amber-400";
}

export default function ConnectionsPage() {
  const [platforms] = useState(PLATFORMS);

  return (
    <PageShell
      title="Connect Platforms"
      subtitle="Sync your professional data to build your decentralized credit profile. More connections increase your reputation and unlock better financial rates."
    >
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {platforms.map((p) => (
          <Card key={p.id} className="flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-light text-gray-400">
                  <p.icon className="h-6 w-6" />
                </div>
                {statusBadge(p.status)}
              </div>
              <h3 className="mt-4 text-lg font-semibold">{p.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                {p.description}
              </p>
              {p.detail && (
                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                  <span>{p.detail}</span>
                  {p.status === "connected" && (
                    <button className="text-brand hover:text-amber-400 transition-colors">
                      Disconnect
                    </button>
                  )}
                </div>
              )}
              {p.id === "wallet" && p.status === "connected" && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-surface-border bg-gray-950 px-3 py-2 text-xs">
                  <span className="font-mono text-gray-400">{p.detail}</span>
                  <StatusBadge label="Primary" variant="success" dot={false} />
                </div>
              )}
            </div>
            <button
              className={`mt-6 w-full rounded-xl py-3 text-sm font-semibold transition-colors ${actionColor(p.status)}`}
            >
              {p.actionLabel}
            </button>
          </Card>
        ))}

        {/* Request Integration */}
        <Card className="flex flex-col items-center justify-center border-dashed text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-light text-gray-500">
            <Plus className="h-6 w-6" />
          </div>
          <h3 className="mt-4 font-semibold">Request Integration</h3>
          <p className="mt-2 text-sm text-gray-500">
            Can&apos;t find your platform? Let us know what you want to connect.
          </p>
        </Card>
      </div>

      {/* Privacy Banner */}
      <div className="mt-10 flex flex-col items-start gap-4 rounded-2xl border border-surface-border bg-surface p-6 sm:flex-row sm:items-center">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand">
          <Shield className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold">Privacy &amp; Security First</h4>
          <p className="mt-1 text-sm text-gray-500">
            CreDeFi uses zero-knowledge proofs to verify your data without
            storing sensitive credentials. Your platform access tokens are
            encrypted and you retain full control over what data is shared with
            lenders.
          </p>
        </div>
        <a
          href="#"
          className="shrink-0 text-sm font-semibold text-brand transition-colors hover:text-amber-400"
        >
          View Security Docs &rarr;
        </a>
      </div>
    </PageShell>
  );
}
