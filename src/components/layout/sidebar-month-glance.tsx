"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getHome } from "@/lib/api";
import { formatCurrency } from "@/lib/formatters";

// A compact "this month" widget for the sidebar: current spend, a thin pace
// bar, and days-to-payday. Hidden when the sidebar is collapsed to icons.
export function SidebarMonthGlance() {
  const { data } = useQuery({
    queryKey: ["home"],
    queryFn: getHome,
    staleTime: 60_000,
  });

  const month = data?.thisMonth;
  if (!month) return null;

  const hasBudget = month.budget > 0;
  // With a budget the bar tracks spend-against-budget; without one it tracks
  // how far through the month we are, so the bar and its caption agree.
  const ratio = hasBudget
    ? month.spent / month.budget
    : month.timeElapsedPercent / 100;
  const percent = Math.min(100, Math.max(0, ratio * 100));

  const barColor = !hasBudget
    ? "bg-muted-foreground/35"
    : ratio >= 1
      ? "bg-destructive"
      : ratio >= 0.85
        ? "bg-amber-500"
        : "bg-primary";

  const caption = hasBudget
    ? `מתוך ${formatCurrency(month.budget)} תקציב`
    : `${Math.round(month.timeElapsedPercent)}% מהחודש עבר`;

  return (
    <Link
      href="/"
      className="group/glance mx-1 block rounded-xl border border-sidebar-border bg-sidebar-accent/40 px-3 py-2.5 transition-colors duration-200 hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:hidden"
    >
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          הוצאות · {month.monthLabel}
        </span>
        {month.daysUntilPayday > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {month.daysUntilPayday} ימים לתשלום
          </span>
        )}
      </div>

      <div className="mt-1 font-serif text-lg font-semibold leading-none tabular-nums">
        {formatCurrency(month.spent)}
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
        {caption}
      </div>
    </Link>
  );
}
