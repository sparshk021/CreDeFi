import { type ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string;
  icon?: ReactNode;
  sub?: string;
}

export function StatCard({ label, value, icon, sub }: StatCardProps) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface p-5">
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          {label}
        </span>
        {icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-light text-brand">
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {sub && <p className="mt-0.5 text-sm text-gray-500">{sub}</p>}
    </div>
  );
}
