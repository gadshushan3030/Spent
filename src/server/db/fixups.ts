import "server-only";

import type Database from "better-sqlite3";
import { computeDedupHash } from "../lib/dedup";

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
 * Safe to call on every startup: it is a no-op when all hashes are current.
 */
export function fixupDedupHashes(db: Database.Database): void {
  const rows = db
    .prepare(
      `SELECT id, workspace_id, account_number, date, original_amount,
              original_currency, description, identifier,
              installment_number, installment_total,
              dedup_hash, dedup_sequence
       FROM transactions ORDER BY id`
    )
    .all() as TxnRow[];

  if (rows.length === 0) return;

  // Compute correct hash for every row
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

  const hasStale = withNewHash.some((r) => r.newHash !== r.dedup_hash);
  if (!hasStale) return;

  // Determine which rows to keep and which to delete.
  // Key = (workspace_id, newHash, dedup_sequence). Keep the lowest id.
  const seen = new Map<string, number>();
  const toDelete: number[] = [];
  const toUpdate: { id: number; hash: string }[] = [];

  for (const r of withNewHash) {
    const key = `${r.workspace_id}|${r.newHash}|${r.dedup_sequence}`;
    const existing = seen.get(key);
    if (existing !== undefined) {
      // Duplicate — remove the newer one
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
      db.prepare(
        `DELETE FROM transactions WHERE id IN (${placeholders})`
      ).run(...toDelete);
    }

    const updateStmt = db.prepare(
      "UPDATE transactions SET dedup_hash = ? WHERE id = ?"
    );
    for (const { id, hash } of toUpdate) {
      updateStmt.run(hash, id);
    }
  })();
}
