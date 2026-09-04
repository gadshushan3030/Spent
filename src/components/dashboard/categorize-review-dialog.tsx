"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { applyCategorize, getCategories } from "@/lib/api";
import { toast } from "sonner";
import type { CategorizePreview } from "@/lib/api";

interface CategorizeReviewDialogProps {
  preview: CategorizePreview;
  onClose: () => void;
  onApplied: () => void;
}

export function CategorizeReviewDialog({
  preview,
  onClose,
  onApplied,
}: CategorizeReviewDialogProps) {
  const { data: existingCategories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => getCategories(),
  });

  // Track per-proposal state: approved (default true), or a fallback name.
  const [approvedMap, setApprovedMap] = useState<Record<string, boolean>>(
    () => Object.fromEntries(preview.proposedCategories.map((p) => [p.name, true]))
  );

  const applyMutation = useMutation({
    mutationFn: () =>
      applyCategorize({
        assignments: preview.assignments.map((a) => ({
          transactionId: a.transactionId,
          categoryName: a.categoryName,
          isNew: a.isNew,
          kind: a.kind,
        })),
        approvedNewCategoryNames: Object.entries(approvedMap)
          .filter(([, ok]) => ok)
          .map(([name]) => name),
      }),
    onSuccess: (data) => {
      toast.success(
        `הוחל על ${data.appliedCount} עסקאות` +
          (data.createdCategoriesCount > 0
            ? ` · נוספו ${data.createdCategoriesCount} קטגוריות חדשות`
            : "")
      );
      onApplied();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "הפעולה נכשלה");
    },
  });

  const approvedCount = useMemo(
    () => Object.values(approvedMap).filter(Boolean).length,
    [approvedMap]
  );
  const totalProposals = preview.proposedCategories.length;

  // How many transactions will land in an existing category, in a new (approved)
  // category, or stay uncategorized.
  const stats = useMemo(() => {
    let toExisting = 0;
    let toNew = 0;
    let willStay = 0;
    for (const a of preview.assignments) {
      if (!a.isNew) toExisting++;
      else if (approvedMap[a.categoryName]) toNew++;
      else willStay++;
    }
    return { toExisting, toNew, willStay };
  }, [preview.assignments, approvedMap]);

  const sortedExistingUsage = useMemo(
    () =>
      Object.entries(preview.existingCategoryUsage)
        .map(([name, count]) => ({
          name,
          count,
          color:
            existingCategories.find((c) => c.name === name)?.color ?? "#B1AA9C",
        }))
        .sort((a, b) => b.count - a.count),
    [preview.existingCategoryUsage, existingCategories]
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="px-6 pb-3 pt-6">
          <DialogTitle className="font-serif text-2xl tracking-tight">
            קטגוריזציה חכמה
          </DialogTitle>
          <DialogDescription>
            קטגוריות מוצעות עבור {preview.uncategorizedCount} עסקאות ללא קטגוריה.
            אשר או דחה קטגוריות חדשות לפני ההחלה.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[55vh] px-6">
          <div className="space-y-6 pb-4">
            {sortedExistingUsage.length > 0 && (
              <section>
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  שימוש בקטגוריות קיימות ({stats.toExisting})
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {sortedExistingUsage.map((c) => (
                    <span
                      key={c.name}
                      className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground">{c.count}</span>
                    </span>
                  ))}
                </div>
              </section>
            )}

            {totalProposals > 0 ? (
              <section>
                <div className="mb-3 flex items-baseline justify-between">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                    קטגוריות חדשות מוצעות ({totalProposals})
                  </h3>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() =>
                        setApprovedMap(
                          Object.fromEntries(
                            preview.proposedCategories.map((p) => [
                              p.name,
                              true,
                            ])
                          )
                        )
                      }
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      אשר הכל
                    </button>
                    <span className="text-xs text-muted-foreground">·</span>
                    <button
                      onClick={() =>
                        setApprovedMap(
                          Object.fromEntries(
                            preview.proposedCategories.map((p) => [
                              p.name,
                              false,
                            ])
                          )
                        )
                      }
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      דחה הכל
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {preview.proposedCategories.map((p) => (
                    <ProposalRow
                      key={p.name}
                      proposal={p}
                      approved={approvedMap[p.name] ?? false}
                      onToggle={(v) =>
                        setApprovedMap((prev) => ({ ...prev, [p.name]: v }))
                      }
                    />
                  ))}
                </div>
              </section>
            ) : (
              <p className="text-sm text-muted-foreground">
                ה-AI לא הציע קטגוריות חדשות. הכל מתאים לרשימה הקיימת.
              </p>
            )}

            {preview.errors && preview.errors.length > 0 && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {preview.errors.length} אצוות נכשלו במהלך הקטגוריזציה. שאר העסקאות עובדו בהצלחה.
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t bg-muted/30 px-6 py-4">
          <div className="mr-auto flex flex-col gap-0.5 text-xs text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">
                {stats.toExisting + stats.toNew}
              </span>{" "}
              יקבלו קטגוריה
              {stats.willStay > 0 && (
                <>
                  {" "}
                  ·{" "}
                  <span className="text-foreground">{stats.willStay}</span> יישארו ללא קטגוריה
                </>
              )}
            </div>
            {totalProposals > 0 && (
              <div>
                <span className="font-medium text-foreground">
                  {approvedCount}
                </span>{" "}
                מתוך {totalProposals} קטגוריות חדשות ייווצרו
              </div>
            )}
          </div>
          <Button variant="ghost" onClick={onClose}>
            ביטול
          </Button>
          <Button
            onClick={() => applyMutation.mutate()}
            disabled={applyMutation.isPending}
          >
            {applyMutation.isPending ? "מחיל..." : "החל"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProposalRow({
  proposal,
  approved,
  onToggle,
}: {
  proposal: { name: string; transactionIds: number[]; samples: string[] };
  approved: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 rounded-xl border p-3 transition-colors ${
        approved ? "border-primary/40 bg-primary/5" : "glass-soft"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-bold tracking-tight">
            {proposal.name}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {proposal.transactionIds.length} עסקאות
          </span>
        </div>
        <div className="mt-1 truncate text-xs text-muted-foreground">
          {proposal.samples.join(" · ")}
        </div>
      </div>
      <Switch
        checked={approved}
        onCheckedChange={onToggle}
        aria-label={`Approve "${proposal.name}"`}
      />
    </div>
  );
}
