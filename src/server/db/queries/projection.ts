import "server-only";

import { getDb } from "../index";
import { toLocalISODate, hebrewMonth } from "../../lib/date-utils";
import { SQL_EXCLUDE_TRACKING } from "./transactions";
import type { SavingsProjection, SavingsProjectionPoint } from "@/lib/types";

const LOOKBACK_MONTHS = 6;
const PROJECT_MONTHS = 12;

interface MonthAgg {
  income: number;
  expenses: number;
}

// Derives the user's typical monthly net (income minus lifestyle expenses)
// from recent *completed* months, then projects savings forward. Tracking
// categories are excluded on both sides so investment/transfer movements
// don't distort the run-rate.
export function getSavingsProjection(workspaceId: number): SavingsProjection {
  const db = getDb();
  const now = new Date();

  // Window: the LOOKBACK_MONTHS completed months before the current one.
  const windowStart = new Date(now.getFullYear(), now.getMonth() - LOOKBACK_MONTHS, 1);
  const windowEnd = new Date(now.getFullYear(), now.getMonth(), 0); // last day of prev month
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const rows = db
    .prepare(
      `SELECT strftime('%Y-%m', DATE(t.date)) as month,
              COALESCE(SUM(CASE WHEN t.kind = 'income'
                                 AND (c.budget_mode IS NULL OR c.budget_mode != 'tracking')
                                THEN t.charged_amount ELSE 0 END), 0) as income,
              COALESCE(SUM(CASE WHEN t.kind = 'expense'
                                 AND (c.budget_mode IS NULL OR c.budget_mode != 'tracking')
                                THEN ABS(t.charged_amount) ELSE 0 END), 0) as expenses
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.workspace_id = ? AND DATE(t.date) >= ? AND DATE(t.date) <= ?
         AND t.status = 'completed'
       GROUP BY month`
    )
    .all(workspaceId, toLocalISODate(windowStart), toLocalISODate(windowEnd)) as Array<{
    month: string;
    income: number;
    expenses: number;
  }>;

  // Only months with real activity count toward the average, so a brand-new
  // workspace with two months of data isn't divided by six.
  const active = rows.filter((r) => r.income > 0 || r.expenses > 0);
  const monthsCounted = active.length;

  const byMonth = new Map<string, MonthAgg>(
    active.map((r) => [r.month, { income: r.income, expenses: r.expenses }])
  );

  const avg = (pick: (m: MonthAgg) => number): number => {
    if (monthsCounted === 0) return 0;
    let sum = 0;
    for (const m of byMonth.values()) sum += pick(m);
    return sum / monthsCounted;
  };

  const avgIncome = avg((m) => m.income);
  const avgExpenses = avg((m) => m.expenses);
  const avgNet = avgIncome - avgExpenses;
  const savingsRate = avgIncome > 0 ? avgNet / avgIncome : 0;

  // Forward cumulative projection starting next month.
  const projection: SavingsProjectionPoint[] = [];
  let cumulative = 0;
  for (let i = 1; i <= PROJECT_MONTHS; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    cumulative += avgNet;
    projection.push({
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: hebrewMonth(d, "short"),
      cumulative: Math.round(cumulative),
    });
  }

  // Run-rate to the calendar year end (this month counts as still in progress).
  const monthsLeftInYear = 12 - now.getMonth();
  const projectedYearEnd = Math.round(avgNet * monthsLeftInYear);

  return {
    monthsCounted,
    avgIncome: Math.round(avgIncome),
    avgExpenses: Math.round(avgExpenses),
    avgNet: Math.round(avgNet),
    savingsRate,
    projectedAnnual: Math.round(avgNet * 12),
    projectedYearEnd,
    currentMonthKey,
    projection,
  };
}
