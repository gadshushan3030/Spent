import "server-only";

import type Database from "better-sqlite3";
import { computeDedupHash } from "../lib/dedup";

const FIXUP_FLAG = "dedup_hash_v2_done";

interface TxnRow {
  id: number;
  workspace_id: number;
  account_number: string;
  date: string;
  original_amount: number;
  original_currency: string;
  description: string;
  identifier: string | null;
  installment_number: number | null;
  installment_total: number | null;
  dedup_hash: string;
  dedup_sequence: number;
}

/**
 * Re-compute dedup hashes for all transactions using the current algorithm
 * (with normalized account numbers). Transactions that still carry stale
 * hashes from a previous algorithm version are silently duplicated on every
 * sync — this fixup collapses them.
 *
 * A settings flag is written after the first successful run so that
 * subsequent startups skip the full table scan entirely.
 */
export function fixupDedupHashes(db: Database.Database): void {
  const already = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(FIXUP_FLAG) as { value: string } | undefined;
  if (already) return;

  const rows = db
    .prepare(
      `SELECT id, workspace_id, account_number, date, original_amount,
              original_currency, description, identifier,
              installment_number, installment_total,
              dedup_hash, dedup_sequence
       FROM transactions ORDER BY id`
    )
    .all() as TxnRow[];

  if (rows.length === 0) {
    markDone(db);
    return;
  }

  const withNewHash = rows.map((r) => ({
    ...r,
    newHash: computeDedupHash({
      accountNumber: r.account_number,
      date: r.date,
      originalAmount: r.original_amount,
      originalCurrency: r.original_currency,
      description: r.description,
      identifier: r.identifier,
      installmentNumber: r.installment_number,
      installmentTotal: r.installment_total,
    }),
  }));

  const seen = new Map<string, number>();
  const toDelete: number[] = [];
  const toUpdate: { id: number; hash: string }[] = [];

  for (const r of withNewHash) {
    const key = `${r.workspace_id}|${r.newHash}|${r.dedup_sequence}`;
    if (seen.has(key)) {
      toDelete.push(r.id);
    } else {
      seen.set(key, r.id);
      if (r.newHash !== r.dedup_hash) {
        toUpdate.push({ id: r.id, hash: r.newHash });
      }
    }
  }

  db.transaction(() => {
    if (toDelete.length > 0) {
      const placeholders = toDelete.map(() => "?").join(",");
      db.prepare(`DELETE FROM transactions WHERE id IN (${placeholders})`).run(...toDelete);
    }
    const updateStmt = db.prepare("UPDATE transactions SET dedup_hash = ? WHERE id = ?");
    for (const { id, hash } of toUpdate) {
      updateStmt.run(hash, id);
    }
    markDone(db);
  })();
}

function markDone(db: Database.Database): void {
  db.prepare(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, '1')"
  ).run(FIXUP_FLAG);
}
