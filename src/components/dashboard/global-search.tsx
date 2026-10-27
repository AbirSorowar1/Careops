import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, User, HeartHandshake } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useDashboard } from "@/hooks/use-dashboard-data";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const { dataset } = useDashboard();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!dataset}
        aria-label="Search clients or caregivers"
        className="flex h-9 w-9 items-center justify-center sm:w-full sm:max-w-xs sm:justify-start gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground shadow-card transition-colors hover:border-brand/40 disabled:opacity-60"
      >
        <Search className="size-4" />
        <span className="hidden flex-1 truncate text-left sm:block">Search clients or caregivers…</span>
        <kbd className="hidden rounded border border-border bg-muted px-1.5 font-mono text-[0.65rem] md:inline">⌘K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Name, customer ID, area or service type…" />
        <CommandList>
          <CommandEmpty>No matching records.</CommandEmpty>
          {dataset && dataset.clients.length > 0 && (
            <CommandGroup heading="Clients">
              {dataset.clients.map((c) => (
                <CommandItem
                  key={c.key}
                  value={`${c.name.value ?? ""} ${c.customerId ?? ""} ${c.area.group ?? ""} ${c.serviceType.group ?? ""} client ${c.key}`}
                  onSelect={() => {
                    setOpen(false);
                    void navigate({ to: "/clients", search: { id: c.key } });
                  }}
                >
                  <User className="text-muted-foreground" />
                  <span className="flex-1 truncate">{c.name.value ?? "Unnamed"}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.customerId} · {c.serviceType.group ?? "—"}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {dataset && dataset.caregivers.length > 0 && (
            <CommandGroup heading="Caregivers">
              {dataset.caregivers.map((c) => (
                <CommandItem
                  key={c.key}
                  value={`${c.name.value ?? ""} ${c.address.group ?? ""} ${c.education.group ?? ""} caregiver ${c.key}`}
                  onSelect={() => {
                    setOpen(false);
                    void navigate({ to: "/caregivers", search: { id: c.key } });
                  }}
                >
                  <HeartHandshake className="text-muted-foreground" />
                  <span className="flex-1 truncate">{c.name.value ?? "Unnamed"}</span>
                  <span className="text-xs text-muted-foreground">
                    SL {c.sl} · {c.address.group ?? "—"}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
