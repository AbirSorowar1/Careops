import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CountRow } from "@/lib/data/metrics";
import { formatNumber, formatPercent } from "@/lib/data/format";
import { cn } from "@/lib/utils";
import { PanelEmpty } from "./page";

export const SERIES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
] as const;

export function seriesColor(i: number): string {
  return SERIES[i % SERIES.length] ?? SERIES[0];
}

function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; payload?: Record<string, unknown> }>;
  label?: string;
  formatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-raised">
      {label != null && <p className="mb-1 font-semibold text-foreground">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span>{p.name}</span>
          <span className="ml-auto font-medium text-foreground tabular">
            {formatter ? formatter(Number(p.value)) : formatNumber(Number(p.value))}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Groups everything after the top N into "Other" so donuts stay readable. */
function topN(rows: CountRow[], n: number): CountRow[] {
  if (rows.length <= n) return rows;
  const head = rows.slice(0, n - 1);
  const rest = rows.slice(n - 1);
  return [
    ...head,
    {
      label: `Other (${rest.length})`,
      count: rest.reduce((a, r) => a + r.count, 0),
      share: rest.reduce((a, r) => a + r.share, 0),
    },
  ];
}

export function DonutChart({
  data,
  centerLabel,
  onSelect,
  maxSlices = 6,
  height = 240,
}: {
  data: CountRow[];
  centerLabel: string;
  onSelect?: (label: string) => void;
  maxSlices?: number;
  height?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  if (!data.length) return <PanelEmpty description="No values recorded for this field." />;
  const rows = topN(data, maxSlices);
  const total = data.reduce((a, r) => a + r.count, 0);
  return (
    <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,220px)_1fr]">
      <div className="relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="count"
              nameKey="label"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={1.5}
              stroke="var(--card)"
              strokeWidth={2}
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onClick={(d: { label?: string }) => d.label && !d.label.startsWith("Other (") && onSelect?.(d.label)}
              className={cn(onSelect && "cursor-pointer")}
              isAnimationActive={false}
            >
              {rows.map((_, i) => (
                <Cell key={i} fill={seriesColor(i)} opacity={active == null || active === i ? 1 : 0.45} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-bold text-foreground tabular">{formatNumber(total)}</span>
          <span className="text-[0.7rem] text-muted-foreground">{centerLabel}</span>
        </div>
      </div>
      <ul className="space-y-1.5">
        {rows.map((r, i) => {
          const clickable = onSelect && !r.label.startsWith("Other (");
          return (
            <li key={r.label}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onSelect?.(r.label)}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  clickable ? "hover:bg-muted" : "cursor-default",
                )}
              >
                <span className="size-2.5 shrink-0 rounded-sm" style={{ background: seriesColor(i) }} />
                <span className="min-w-0 flex-1 truncate text-foreground">{r.label}</span>
                <span className="text-muted-foreground tabular">{formatNumber(r.count)}</span>
                <span className="w-11 text-right text-xs text-muted-foreground tabular">{formatPercent(r.share)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Ranked horizontal bars rendered in HTML so long labels stay readable. */
export function RankedBars({
  data,
  onSelect,
  max = 10,
  valueFormatter = (v) => formatNumber(v),
  tone = "brand",
  showShare = true,
  emptyText = "No values recorded for this field.",
}: {
  data: CountRow[];
  onSelect?: ((label: string) => void) | undefined;
  max?: number;
  valueFormatter?: (v: number) => string;
  tone?: "brand" | "teal" | "navy";
  showShare?: boolean;
  emptyText?: string;
}) {
  if (!data.length) return <PanelEmpty description={emptyText} />;
  const rows = data.slice(0, max);
  const top = Math.max(...rows.map((r) => r.count), 1);
  const bar = { brand: "bg-brand", teal: "bg-teal", navy: "bg-navy" }[tone];
  return (
    <div className="space-y-1">
      {rows.map((r, i) => (
        <button
          type="button"
          key={r.label}
          disabled={!onSelect}
          onClick={() => onSelect?.(r.label)}
          title={`${r.label}: ${valueFormatter(r.count)}`}
          className={cn(
            "group grid w-full grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-md px-2 py-1.5 text-left",
            onSelect ? "hover:bg-muted" : "cursor-default",
          )}
        >
          <span className="text-xs text-muted-foreground tabular">{i + 1}</span>
          <span className="truncate text-sm text-foreground">{r.label}</span>
          <span className="text-right text-sm font-medium text-foreground tabular">
            {valueFormatter(r.count)}
            {showShare && <span className="ml-2 text-xs font-normal text-muted-foreground">{formatPercent(r.share)}</span>}
          </span>
          <span />
          <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <span
              className={cn("block h-full rounded-full transition-all", bar, onSelect && "group-hover:opacity-85")}
              style={{ width: `${Math.max((r.count / top) * 100, 2)}%` }}
            />
          </span>
        </button>
      ))}
      {data.length > max && (
        <p className="px-2 pt-1 text-xs text-muted-foreground">+ {data.length - max} more not shown</p>
      )}
    </div>
  );
}

export function ColumnChart({
  data,
  onSelect,
  height = 240,
  color = SERIES[0] as string,
  valueLabel = "Records",
}: {
  data: CountRow[];
  onSelect?: (label: string) => void;
  height?: number;
  color?: string;
  valueLabel?: string;
}) {
  if (!data.some((d) => d.count > 0)) return <PanelEmpty description="No values recorded for this field." />;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval={0} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltip />} />
          <Bar
            dataKey="count"
            name={valueLabel}
            fill={color}
            radius={[5, 5, 0, 0]}
            maxBarSize={44}
            isAnimationActive={false}
            onClick={(d: { label?: string }) => d.label && onSelect?.(d.label)}
            className={cn(onSelect && "cursor-pointer")}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface ComparisonDatum {
  label: string;
  [series: string]: number | string;
}

export function ComparisonChart({
  data,
  series,
  formatter,
  height = 280,
  layout = "vertical",
  onSelect,
}: {
  data: ComparisonDatum[];
  series: Array<{ key: string; name: string; color: string }>;
  formatter: (v: number) => string;
  height?: number;
  layout?: "vertical" | "horizontal";
  onSelect?: (label: string) => void;
}) {
  if (!data.length) return <PanelEmpty description="No payment values recorded." />;
  const horizontal = layout === "horizontal";
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 8, right: 12, left: horizontal ? 8 : 4, bottom: 0 }}
          barGap={3}
        >
          <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke="var(--border)" />
          {/* Recharts needs axes as direct children (no fragments). */}
          {horizontal ? (
            <XAxis type="number" tickFormatter={formatter} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          ) : (
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval={0} />
          )}
          {horizontal ? (
            <YAxis type="category" dataKey="label" width={130} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--foreground)" }} />
          ) : (
            <YAxis tickFormatter={formatter} tickLine={false} axisLine={false} width={64} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          )}
          <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltip formatter={formatter} />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              fill={s.color}
              radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              maxBarSize={28}
              isAnimationActive={false}
              onClick={(d: { label?: string }) => d.label && onSelect?.(d.label)}
              className={cn(onSelect && "cursor-pointer")}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CompletenessBar({
  segments,
}: {
  segments: Array<{ label: string; value: number; tone: "success" | "warning" | "danger" | "muted" }>;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const tone = { success: "bg-success", warning: "bg-warning", danger: "bg-danger", muted: "bg-muted-foreground/40" };
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        {segments.map((s) =>
          s.value > 0 ? (
            <span key={s.label} className={tone[s.tone]} style={{ width: `${(s.value / Math.max(total, 1)) * 100}%` }} />
          ) : null,
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", tone[s.tone])} />
            {s.label} <span className="font-medium text-foreground tabular">{formatNumber(s.value)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
