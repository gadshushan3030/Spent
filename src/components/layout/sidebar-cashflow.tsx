"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getHome } from "@/lib/api";
import { formatCurrency } from "@/lib/formatters";
import type { HomeHistoricalTrendPoint } from "@/lib/types";

// The sidebar centerpiece: income vs expenses for the current month, plus a
// compact multi-month bar history. Hidden when the sidebar is icon-collapsed.
export function SidebarCashflow() {
  const { data } = useQuery({
    queryKey: ["home"],
    queryFn: getHome,
    staleTime: 60_000,
  });

  const cashFlow = data?.cashFlow;
  const trend = data?.thisMonth;
  const history = data?.historicalTrend ?? [];
  if (!cashFlow || !trend) return null;

  const netPositive = cashFlow.net >= 0;
  const netColor = netPositive
    ? "var(--status-on-track)"
    : "var(--status-over)";

  return (
    <Link
      href="/"
      className="mx-1 block rounded-xl border border-sidebar-border bg-sidebar-accent/40 px-3 py-3 transition-colors duration-200 hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:hidden"
    >
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          הכנסות מול הוצאות
        </span>
        <span className="text-[10px] text-muted-foreground">
          {trend.monthLabel}
        </span>
      </div>

      <div className="mt-2 space-y-1.5">
        <Line
          label="הכנסות"
          value={cashFlow.income}
          color="var(--status-on-track)"
        />
        <Line
          label="הוצאות"
          value={cashFlow.expenses}
          color="var(--status-over)"
        />
      </div>

      <div className="mt-2 flex items-baseline justify-between border-t border-sidebar-border pt-2">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          נטו
        </span>
        <span
          className="font-serif text-base font-semibold tabular-nums"
          style={{ color: netColor }}
        >
          {netPositive ? "+" : "−"}
          {formatCurrency(Math.abs(cashFlow.net))}
        </span>
      </div>

      {history.length > 0 && <MiniBars history={history} />}
    </Link>
  );
}

function Line({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="text-[13px] tabular-nums" style={{ color }}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}

function MiniBars({ history }: { history: HomeHistoricalTrendPoint[] }) {
  const recent = history.slice(-5);
  const max = Math.max(
    ...recent.map((d) => Math.max(d.income, d.expenses)),
    1
  );

  // dir=ltr so the bars and month labels stay in the same order in RTL.
  return (
    <div className="mt-3" dir="ltr">
      <div className="flex h-12 items-end justify-between gap-1.5">
        {recent.map((d) => (
          <div key={d.month} className="flex flex-1 items-end justify-center gap-0.5">
            <Bar heightPct={(d.income / max) * 100} color="var(--status-on-track)" />
            <Bar heightPct={(d.expenses / max) * 100} color="var(--status-over)" />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between gap-1.5 text-[9px] text-muted-foreground">
        {recent.map((d) => (
          <span key={d.month} className="flex-1 text-center">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Bar({ heightPct, color }: { heightPct: number; color: string }) {
  return (
    <div
      className="w-1.5 rounded-sm"
      style={{
        height: `${Math.max(heightPct, 3)}%`,
        background: color,
      }}
    />
  );
}
