import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { EmptyState } from "./states";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-[1.7rem]">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "brand",
  footer,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: LucideIcon;
  tone?: "brand" | "teal" | "navy" | "warning" | "success" | "danger";
  footer?: ReactNode;
}) {
  const toneClass = {
    brand: "bg-brand-soft text-brand",
    teal: "bg-teal-soft text-teal",
    navy: "bg-secondary text-navy",
    warning: "bg-warning-soft text-warning-foreground",
    success: "bg-success-soft text-success",
    danger: "bg-danger-soft text-danger",
  }[tone];
  return (
    <div className="surface flex flex-col gap-3 p-5 transition-shadow hover:shadow-raised">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.8rem] font-medium text-muted-foreground">{label}</p>
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", toneClass)}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="font-display text-[1.75rem] font-bold leading-none tracking-tight text-foreground tabular">{value}</p>
      {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      {footer}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  info,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  info?: string;
}) {
  return (
    <section className={cn("surface flex min-w-0 flex-col", className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            {title && (
              <h2 className="flex items-center gap-1.5 text-[0.95rem] font-semibold text-foreground">
                {title}
                {info && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="About this chart">
                        <Info className="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">{info}</TooltipContent>
                  </Tooltip>
                )}
              </h2>
            )}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="no-print flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("flex-1 p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function PanelEmpty({ title = "Not enough data", description }: { title?: string; description?: string | undefined }) {
  return <EmptyState title={title} description={description} />;
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" }) {
  return (
    <div
      className={cn(
        "flex gap-2.5 rounded-lg border px-4 py-3 text-xs leading-relaxed",
        tone === "info" ? "border-brand/20 bg-brand-soft text-foreground" : "border-warning/30 bg-warning-soft text-warning-foreground",
      )}
    >
      <Info className={cn("mt-0.5 size-3.5 shrink-0", tone === "info" ? "text-brand" : "text-warning-foreground")} />
      <div>{children}</div>
    </div>
  );
}
