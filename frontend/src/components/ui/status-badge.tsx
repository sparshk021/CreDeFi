const VARIANT_MAP: Record<string, string> = {
  success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  error: "bg-red-500/15 text-red-400 border-red-500/30",
  info: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  neutral: "bg-gray-500/15 text-gray-400 border-gray-500/30",
};

interface StatusBadgeProps {
  label: string;
  variant?: keyof typeof VARIANT_MAP;
  dot?: boolean;
}

export function StatusBadge({
  label,
  variant = "neutral",
  dot = true,
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${VARIANT_MAP[variant]}`}
    >
      {dot && (
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
      )}
      {label}
    </span>
  );
}
