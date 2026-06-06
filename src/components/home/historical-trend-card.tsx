"use client";

import { useState } from "react";
import { CardShell } from "./card-shell";
import { formatCurrency } from "@/lib/formatters";
import type { HomeHistoricalTrendPoint } from "@/lib/types";

interface Props {
  data: HomeHistoricalTrendPoint[];
}

export function HistoricalTrendCard({ data }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const hasData = data.some((d) => d.income > 0 || d.expenses > 0);

  if (!hasData) {
    return (
      <CardShell label="הכנסות מול הוצאות">
        <div className="flex flex-1 items-center justify-center py-6 text-sm text-muted-foreground">
          אין מספיק היסטוריה עדיין.
        </div>
      </CardShell>
    );
  }

  const max = Math.max(...data.map((d) => Math.max(d.income, d.expenses)), 1);
  const active = hoverIdx != null ? data[hoverIdx] : data[data.length - 1];
  const netPositive = active.net >= 0;

  return (
    <CardShell label="הכנסות מול הוצאות">
      <div className="flex flex-1 flex-col justify-between gap-4">
        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground">
            {active.label}
            {active.isCurrent ? " (עד כה)" : ""}
          </div>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <Stat label="הכנסות" value={active.income} color="var(--status-on-track)" />
            <Stat label="הוצאות" value={active.expenses} color="var(--status-over)" />
          </div>
          <div className="flex items-baseline gap-1.5 pt-0.5">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              נטו
            </span>
            <span
              className="font-serif text-xl tabular-nums"
              style={{
                color: netPositive
                  ? "var(--status-on-track)"
                  : "var(--status-over)",
              }}
            >
              {netPositive ? "+" : "−"}
              {formatCurrency(Math.abs(active.net))}
            </span>
          </div>
        </div>

        <GroupedBars
          data={data}
          max={max}
          hoverIdx={hoverIdx}
          onHover={setHoverIdx}
        />

        <Legend />
      </div>
    </CardShell>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-lg tabular-nums" style={{ color }}>
        {formatCurrency(value)}
      </span>
    </span>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: "var(--status-on-track)" }}
        />
        הכנסות
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: "var(--status-over)" }}
        />
        הוצאות
      </span>
    </div>
  );
}

function GroupedBars({
  data,
  max,
  hoverIdx,
  onHover,
}: {
  data: HomeHistoricalTrendPoint[];
  max: number;
  hoverIdx: number | null;
  onHover: (i: number | null) => void;
}) {
  const width = 100;
  const height = 40;
  const slot = width / data.length;
  const pair = slot * 0.62;
  const bar = pair * 0.46;
  const innerGap = pair - bar * 2;
  const sidePad = (slot - pair) / 2;

  // dir=ltr keeps the SVG bars and the label row in the same index order, so
  // each month's bars sit directly above its label even inside an RTL page.
  return (
    <div className="flex flex-col gap-2" dir="ltr" onMouseLeave={() => onHover(null)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-28 w-full overflow-visible"
      >
        {data.map((d, i) => {
          const base = i * slot + sidePad;
          const incH = (d.income / max) * (height - 2);
          const expH = (d.expenses / max) * (height - 2);
          const dim =
            hoverIdx == null ? (d.isCurrent ? 1 : 0.78) : hoverIdx === i ? 1 : 0.32;
          return (
            <g
              key={d.month}
              className="cursor-pointer transition-opacity"
              style={{ opacity: dim }}
              onMouseEnter={() => onHover(i)}
            >
              <rect
                x={base}
                y={height - incH}
                width={bar}
                height={Math.max(incH, 0.5)}
                rx={0.6}
                fill="var(--status-on-track)"
              />
              <rect
                x={base + bar + innerGap}
                y={height - expH}
                width={bar}
                height={Math.max(expH, 0.5)}
                rx={0.6}
                fill="var(--status-over)"
              />
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
        {data.map((d) => (
          <span
            key={d.month}
            className={d.isCurrent ? "font-medium text-foreground" : ""}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
