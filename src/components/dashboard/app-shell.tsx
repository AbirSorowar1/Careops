import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { useDashboard } from "@/hooks/use-dashboard-data";
import { formatDateTime } from "@/lib/data/format";
import { NAV_ITEMS, type NavItem } from "./nav";
import { GlobalSearch } from "./global-search";
import { RefreshButton, SyncBanner, SyncStatus } from "./sync-status";

const GROUPS: NavItem["group"][] = ["Overview", "Directories", "Analysis", "Admin"];

function useActivePath() {
  return useRouterState({ select: (s) => s.location.pathname });
}

function AppSidebar() {
  const path = useActivePath();
  const { dataset, lastSuccessAt } = useDashboard();
  const { setOpenMobile } = useSidebar();
  const issueCount = dataset?.issues.filter((i) => i.severity !== "info").length ?? 0;

  return (
    <Sidebar collapsible="icon" className="no-print">
      <SidebarHeader className="px-3 py-4">
        <Link to="/" className="flex items-center gap-2.5 overflow-hidden">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Activity className="size-4" />
          </span>
          <span className="min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="block truncate font-display text-sm font-bold text-sidebar-accent-foreground">CareOps Insight</span>
            <span className="block truncate text-[0.7rem] text-sidebar-foreground/70">Clients & Caregivers</span>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {GROUPS.map((g) => (
          <SidebarGroup key={g}>
            <SidebarGroupLabel className="text-sidebar-foreground/50">{g}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.filter((n) => n.group === g).map((n) => {
                  const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
                  return (
                    <SidebarMenuItem key={n.to}>
                      <SidebarMenuButton asChild isActive={active} tooltip={n.label}>
                        <Link to={n.to} onClick={() => setOpenMobile(false)}>
                          <n.icon />
                          <span>{n.label}</span>
                          {n.to === "/data-quality" && issueCount > 0 && (
                            <span className="ml-auto rounded-full bg-warning/20 px-1.5 text-[0.65rem] font-semibold text-warning group-data-[collapsible=icon]:hidden">
                              {issueCount}
                            </span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="px-4 py-4 group-data-[collapsible=icon]:hidden">
        <div className="rounded-lg bg-sidebar-accent px-3 py-2.5 text-[0.7rem] leading-relaxed text-sidebar-foreground/80">
          <p className="font-semibold text-sidebar-accent-foreground">{dataset?.title ?? "Google Sheets"}</p>
          <p>Last sync {formatDateTime(lastSuccessAt)}</p>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function TopBar() {
  const path = useActivePath();
  const current = NAV_ITEMS.find((n) => (n.to === "/" ? path === "/" : path.startsWith(n.to)));
  return (
    <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur md:px-8">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <div className="min-w-0">
        <p className="hidden text-[0.7rem] text-muted-foreground sm:block">CareOps Insight</p>
        <p className="truncate text-sm font-semibold text-foreground">{current?.label ?? "Dashboard"}</p>
      </div>
      <div className="ml-auto flex flex-1 items-center justify-end gap-2">
        <div className="flex flex-1 justify-end">
          <GlobalSearch />
        </div>
        <div className="hidden sm:block"><SyncStatus /></div>
        <div className="sm:hidden"><SyncStatus compact /></div>
        <RefreshButton />
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0 bg-background">
        <TopBar />
        <SyncBanner />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
