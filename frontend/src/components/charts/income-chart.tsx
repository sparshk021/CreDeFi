"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface IncomeChartProps {
  data: { month: string; confirmed: number; projected: number }[];
}

export function IncomeChart({ data }: IncomeChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} barGap={4}>
        <XAxis
          dataKey="month"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#9ca3af", fontSize: 12 }}
        />
        <YAxis hide />
        <Tooltip
          contentStyle={{
            background: "#1f2937",
            border: "1px solid #374151",
            borderRadius: 8,
            color: "#f3f4f6",
          }}
          formatter={(v) => `$${Number(v).toLocaleString()}`}
        />
        <Legend
          align="right"
          verticalAlign="top"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: "#9ca3af" }}
        />
        <Bar
          dataKey="confirmed"
          name="Confirmed"
          fill="#22c55e"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="projected"
          name="Projected"
          fill="#f59e0b"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
