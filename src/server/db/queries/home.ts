import "server-only";

import { getDb } from "../index";
import { hebrewMonth, toLocalISODate } from "../../lib/date-utils";
import { SQL_EXCLUDE_TRACKING } from "./transactions";
import type {
  HomeBankHealthItem,
  HomeCashFlow,
  HomeCategorySnapshotItem,
  HomeHistoricalTrendPoint,
  HomeNeedsAttention,
  HomeRecentTransaction,
} from "@/lib/types";
import { BANK_PROVIDERS } from "@/lib/types";

export function getCashFlow(
  workspaceId: number,
  from: string,
  to: string
): HomeCashFlow {
  const db = getDb();
  const income = db
    .prepare(
      `SELECT COALESCE(SUM(charged_amount), 0) as total
       FROM transactions
       WHERE workspace_id = ? AND DATE(date) >= ? AND DATE(date) <= ?
         AND status = 'completed' AND kind = 'income'`
    )
    .get(workspaceId, from, to) as { total: number };
  const expenses = db
    .prepare(
      `SELECT COALESCE(SUM(ABS(t.charged_amount)), 0) as total
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.workspace_id = ? AND DATE(t.date) >= ? AND DATE(t.date) <= ?
         AND t.status = 'completed' AND t.kind = 'expense'
         ${SQL_EXCLUDE_TRACKING}`
    )
    .get(workspaceId, from, to) as { total: number };
  return {
    income: income.total,
    expenses: expenses.total,
    net: income.total - expenses.total,
  };
}

export function getHistoricalTrend(
  workspaceId: number,
  monthsBack: number
): HomeHistoricalTrendPoint[] {
  const db = getDb();
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const months: { key: string; label: string }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
    months.push({ key, label: hebrewMonth(start, "short") });
  }

  const rangeStart = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 1);
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const rows = db
    .prepare(
      `SELECT strftime('%Y-%m', DATE(t.date)) as month,
              COALESCE(SUM(ABS(t.charged_amount)), 0) as total
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.workspace_id = ? AND DATE(t.date) >= ? AND DATE(t.date) <= ?
         AND t.status = 'completed' AND t.kind = 'expense'
         ${SQL_EXCLUDE_TRACKING}
       GROUP BY month`
    )
    .all(workspaceId, toLocalISODate(rangeStart), toLocalISODate(rangeEnd)) as {
    month: string;
    total: number;
  }[];

  const totalByMonth = new Map(rows.map((r) => [r.month, r.total]));

  return months.map((m) => ({
    month: m.key,
    label: m.label,
    total: totalByMonth.get(m.key) ?? 0,
    isCurrent: m.key === currentMonthKey,
  }));
}

export function getRecentTransactionsForHome(
  workspaceId: number,
  limit: number
): HomeRecentTransaction[] {
  const rows = getDb()
    .prepare(
      `SELECT t.id, t.date, t.description, t.charged_amount as chargedAmount,
              t.charged_currency as chargedCurrency, t.kind,
              c.name as categoryName, c.color as categoryColor
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.workspace_id = ? AND t.status = 'completed' AND t.kind != 'transfer'
       ORDER BY t.date DESC, t.id DESC
       LIMIT ?`
    )
    .all(workspaceId, limit) as Array<{
    id: number;
    date: string;
    description: string;
    chargedAmount: number;
    chargedCurrency: string | null;
    kind: "expense" | "income" | "transfer";
    categoryName: string | null;
    categoryColor: string | null;
  }>;
  return rows;
}

export function getNeedsAttentionCounts(
  workspaceId: number
): HomeNeedsAttention {
  const row = getDb()
    .prepare(
      `SELECT
         SUM(CASE WHEN category_id IS NULL AND kind = 'expense' THEN 1 ELSE 0 END) AS uncategorized,
         SUM(CASE WHEN ai_confidence IS NOT NULL AND ai_confidence < 0.5
                       AND category_source = 'ai' THEN 1 ELSE 0 END) AS lowConfidence,
         SUM(CASE WHEN needs_review = 1 THEN 1 ELSE 0 END) AS flagged
       FROM transactions
       WHERE workspace_id = ? AND status = 'completed'`
    )
    .get(workspaceId) as {
    uncategorized: number | null;
    lowConfidence: number | null;
    flagged: number | null;
  };
  return {
    uncategorized: row.uncategorized ?? 0,
    lowConfidence: row.lowConfidence ?? 0,
    flagged: row.flagged ?? 0,
  };
}

export function getBankHealth(workspaceId: number): HomeBankHealthItem[] {
  const db = getDb();
  const creds = db
    .prepare(
      `SELECT provider FROM bank_credentials WHERE workspace_id = ? ORDER BY provider`
    )
    .all(workspaceId) as { provider: string }[];

  const latestRunStmt = db.prepare(
    `SELECT status, completed_at, error_message FROM sync_runs
     WHERE workspace_id = ? AND provider = ?
     ORDER BY started_at DESC LIMIT 1`
  );

  const staleThresholdMs = 24 * 60 * 60 * 1000;
  const now = Date.now();

  return creds.map(({ provider }) => {
    const latest = latestRunStmt.get(workspaceId, provider) as
      | { status: string; completed_at: string | null; error_message: string | null }
      | undefined;
    const providerInfo = BANK_PROVIDERS.find((p) => p.id === provider);
    const providerName = providerInfo?.name ?? provider;

    if (!latest) {
      return {
        provider,
        providerName,
        lastSyncAt: null,
        status: "never",
        errorMessage: null,
      };
    }

    if (latest.status === "failed") {
      return {
        provider,
        providerName,
        lastSyncAt: latest.completed_at,
        status: "error",
        errorMessage: latest.error_message,
      };
    }

    if (!latest.completed_at) {
      return {
        provider,
        providerName,
        lastSyncAt: null,
        status: "never",
        errorMessage: null,
      };
    }

    const ageMs = now - new Date(latest.completed_at + "Z").getTime();
    const status: "ok" | "stale" = ageMs > staleThresholdMs ? "stale" : "ok";
    return {
      provider,
      providerName,
      lastSyncAt: latest.completed_at,
      status,
      errorMessage: null,
    };
  });
}

export function getCategorySnapshot(
  workspaceId: number,
  from: string,
  to: string,
  limit: number
): HomeCategorySnapshotItem[] {
  const db = getDb();

  const categories = db
    .prepare(
      `SELECT id, parent_id as parentId, name, color
       FROM categories WHERE workspace_id = ? AND kind = 'expense'`
    )
    .all(workspaceId) as Array<{
    id: number;
    parentId: number | null;
    name: string;
    color: string;
  }>;

  const parentIds = new Set<number>();
  for (const c of categories) {
    if (c.parentId != null) parentIds.add(c.parentId);
  }

  const spendRows = db
    .prepare(
      `SELECT category_id as categoryId, SUM(ABS(charged_amount)) as amount
       FROM transactions
       WHERE workspace_id = ? AND DATE(date) >= ? AND DATE(date) <= ?
         AND status = 'completed' AND kind = 'expense'
         AND category_id IS NOT NULL
       GROUP BY category_id`
    )
    .all(workspaceId, from, to) as Array<{ categoryId: number; amount: number }>;

  const budgetRows = db
    .prepare(
      `SELECT category_id as categoryId, monthly_amount as monthlyAmount
       FROM budgets WHERE workspace_id = ?`
    )
    .all(workspaceId) as Array<{ categoryId: number; monthlyAmount: number }>;

  const budgetByCategory = new Map<number, number>();
  for (const b of budgetRows) budgetByCategory.set(b.categoryId, b.monthlyAmount);

  // Roll each leaf's spend up to its parent if it has one, else under its own id.
  const rolledSpend = new Map<number, number>();
  const rolledBudget = new Map<number, number>();

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  for (const row of spendRows) {
    const cat = categoryById.get(row.categoryId);
    if (!cat) continue;
    const key = cat.parentId ?? cat.id;
    rolledSpend.set(key, (rolledSpend.get(key) ?? 0) + row.amount);
  }

  // Roll up budgets the same way. Parent's explicit budget takes precedence
  // over the sum of children when it exists.
  for (const cat of categories) {
    const explicit = budgetByCategory.get(cat.id);
    if (explicit == null) continue;
    const key = cat.parentId ?? cat.id;
    if (cat.parentId == null && parentIds.has(cat.id)) {
      // This is a parent with its own explicit budget — use it directly.
      rolledBudget.set(key, explicit);
    } else {
      // Leaf budget: only add if parent doesn't have its own explicit budget.
      const parentHasOwnBudget =
        cat.parentId != null && budgetByCategory.has(cat.parentId);
      if (parentHasOwnBudget) continue;
      rolledBudget.set(key, (rolledBudget.get(key) ?? 0) + explicit);
    }
  }

  const items: HomeCategorySnapshotItem[] = [];
  for (const [key, spent] of rolledSpend) {
    const cat = categoryById.get(key);
    if (!cat) continue;
    const budget = rolledBudget.get(key) ?? 0;
    items.push({
      categoryId: key,
      name: cat.name,
      color: cat.color,
      spent,
      budget,
      percentSpent: budget > 0 ? (spent / budget) * 100 : 0,
    });
  }

  items.sort((a, b) => b.spent - a.spent);
  return items.slice(0, limit);
}
