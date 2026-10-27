import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const ALL = "__all__";

export function FilterSelect({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: string | undefined;
  options: string[];
  onChange: (value: string | undefined) => void;
  className?: string;
}) {
  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : v)}>
      <SelectTrigger className={cn("h-9 w-full bg-card sm:w-[180px]", value && "border-brand/50 text-brand", className)} aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All {label.toLowerCase()}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 bg-card pl-9" />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function FilterBar({
  children,
  active,
  onReset,
  count,
  total,
  noun,
}: {
  children: React.ReactNode;
  active: boolean;
  onReset: () => void;
  count: number;
  total: number;
  noun: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col flex-wrap gap-2 sm:flex-row sm:items-center">{children}</div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="tabular">
          Showing <span className="font-semibold text-foreground">{count}</span> of {total} {noun}
        </span>
        {active && (
          <Button variant="ghost" size="sm" onClick={onReset} className="h-7 text-xs">
            <X className="size-3" /> Reset filters
          </Button>
        )}
      </div>
    </div>
  );
}
