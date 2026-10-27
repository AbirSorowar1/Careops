import { Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { MoneyField, TextField } from "@/lib/data/types";
import { formatMoney } from "@/lib/data/format";

export function Missing({ label = "Not recorded" }: { label?: string }) {
  return <span className="rounded bg-warning-soft px-1.5 py-0.5 text-xs font-medium text-warning-foreground">{label}</span>;
}

export function TextValue({ field, showGroup = true }: { field: TextField; showGroup?: boolean }) {
  if (!field.value) return <Missing />;
  const label = showGroup ? field.group ?? field.value : field.value;
  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      {field.source === "merged" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link2 className="size-3 text-muted-foreground" aria-label="From merged cell" />
          </TooltipTrigger>
          <TooltipContent>Value comes from a merged cell covering several rows</TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}

export function MoneyValue({ field, currency }: { field: MoneyField; currency: string }) {
  if (field.status === "missing") return <Missing />;
  if (field.status === "invalid")
    return <span className="rounded bg-danger-soft px-1.5 py-0.5 text-xs font-medium text-danger">Invalid</span>;
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      {field.shared && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Badge variant="info" className="px-1.5 text-[0.65rem]">
                Shared ×{field.shared.rows.length}
              </Badge>
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            One merged amount covering SL {field.shared.slNumbers.join(", ")}. Counted once in totals.
          </TooltipContent>
        </Tooltip>
      )}
      <span>{formatMoney(field.amount, currency)}</span>
    </span>
  );
}

export function CompletenessBadge({ complete, missing }: { complete: boolean; missing: string[] }) {
  if (complete) return <Badge variant="success">Complete</Badge>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Badge variant="warning">{missing.length} missing</Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent>{missing.join(", ")}</TooltipContent>
    </Tooltip>
  );
}
