import "server-only";

import crypto from "crypto";

interface DedupFields {
  accountNumber: string;
  date: string;
  originalAmount: number;
  originalCurrency: string;
  description: string;
  identifier?: string | number | null;
  installmentNumber?: number | null;
  installmentTotal?: number | null;
}

// Israeli banks sometimes append a sub-account suffix (e.g. "_80", "_00") that
// varies between scraper runs for the same physical account. Strip it so the
// same transaction doesn't get inserted twice with different hashes.
function normalizeAccountNumber(accountNumber: string): string {
  return accountNumber.replace(/_\d+$/, "");
}

export function computeDedupHash(fields: DedupFields): string {
  const parts = [
    normalizeAccountNumber(fields.accountNumber),
    fields.date,
    String(fields.originalAmount),
    fields.originalCurrency,
    fields.description,
    fields.identifier != null ? String(fields.identifier) : "",
    fields.installmentNumber != null ? String(fields.installmentNumber) : "",
    fields.installmentTotal != null ? String(fields.installmentTotal) : "",
  ];

  return crypto.createHash("sha256").update(parts.join("|")).digest("hex");
}
