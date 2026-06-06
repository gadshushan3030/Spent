"use client";

import { useQuery } from "@tanstack/react-query";
import { CardShell, CardSkeleton } from "./card-shell";
import { getProjection } from "@/lib/api";
import type { SavingsProjectionPoint } from "@/lib/types";

const shekel = (n: number): string =>
  `${n < 0 ? "−" : ""}₪${Math.abs(n).toLocaleString("en-IL")}`;

export function SavingsTrajectoryCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["projection"],
    queryFn: getProjection,
    staleTime: 60_000,
  });

  if (isLoading) return <CardSkeleton label="מסלול החיסכון" height={200} />;
  if (!data || data.monthsCounted === 0) {
    return (
      <CardShell label="מסלול החיסכון">
        <div className="flex flex-1 items-center justify-center py-10 text-sm text-muted-foreground">
          צריך לפחות חודש שלם של נתונים כדי לחזות את מסלול החיסכון.
        </div>
      </CardShell>
    );
  }

  const saving = data.avgNet >= 0;
  const accent = saving ? "var(--status-on-track)" : "var(--status-over)";
  const ratePct = Math.round(data.savingsRate * 100);

  return (
    <CardShell label="מסלול החיסכון">
      <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:items-center">
        <div className="flex items-center gap-5 lg:w-[300px] lg:shrink-0">
          <SavingsRing ratePct={ratePct} accent={accent} />
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">
              {saving ? "בקצב הזה תחסוך השנה" : "בקצב הזה תהיה בגירעון השנה"}
            </div>
            <div
              className="font-serif text-3xl font-semibold tabular-nums"
              style={{ color: accent }}
            >
              {shekel(data.projectedAnnual)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              ממוצע {shekel(data.avgNet)} לחודש · {data.monthsCounted} חודשים
            </div>
          </div>
        </div>

        <div className="flex-1">
          <ProjectionArea points={data.projection} accent={accent} />
        </div>
      </div>
    </CardShell>
  );
}

function SavingsRing({ ratePct, accent }: { ratePct: number; accent: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, ratePct));
  const dash = (clamped / 100) * c;

  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="var(--muted)"
          strokeWidth="8"
        />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke={accent}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          className="transition-[stroke-dasharray] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-serif text-xl font-semibold tabular-nums"
          style={{ color: accent }}
        >
          {ratePct}%
        </span>
        <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
          נחסך
        </span>
      </div>
    </div>
  );
}

function ProjectionArea({
  points,
  accent,
}: {
  points: SavingsProjectionPoint[];
  accent: string;
}) {
  const w = 320;
  const h = 96;
  const padY = 8;

  const values = points.map((p) => p.cumulative);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;

  const x = (i: number) => (i / (points.length - 1)) * w;
  const y = (v: number) => padY + (1 - (v - min) / span) * (h - padY * 2);
  const zeroY = y(0);

  // Smooth the line with quadratic midpoint curves for an elegant trajectory.
  let d = `M ${x(0)} ${y(values[0])}`;
  for (let i = 1; i < points.length; i++) {
    const xc = (x(i - 1) + x(i)) / 2;
    const yc = (y(values[i - 1]) + y(values[i])) / 2;
    d += ` Q ${x(i - 1)} ${y(values[i - 1])} ${xc} ${yc}`;
  }
  d += ` T ${x(points.length - 1)} ${y(values[points.length - 1])}`;

  const areaD = `${d} L ${x(points.length - 1)} ${zeroY} L ${x(0)} ${zeroY} Z`;
  const gradId = "trajGrad";
  const endVal = values[values.length - 1];

  // dir=ltr keeps the curve and the month labels in the same order in RTL.
  return (
    <div dir="ltr">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-28 w-full overflow-visible">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.28" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line
          x1="0"
          y1={zeroY}
          x2={w}
          y2={zeroY}
          stroke="var(--border)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        <path d={areaD} fill={`url(#${gradId})`} />
        <path
          d={d}
          fill="none"
          stroke={accent}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={x(points.length - 1)} cy={y(endVal)} r="3.5" fill={accent} />
      </svg>
      <div className="mt-1 flex justify-between text-[9px] text-muted-foreground tabular-nums">
        {points.map((p, i) =>
          i % 2 === 0 || i === points.length - 1 ? (
            <span key={p.month}>{p.label}</span>
          ) : (
            <span key={p.month} />
          )
        )}
      </div>
    </div>
  );
}
