"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Settings as SettingsIcon,
  Star,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { SidebarCashflow } from "./sidebar-cashflow";
import { getHome } from "@/lib/api";

type NavItem = {
  href: string;
  label: string;
  Icon: typeof LayoutDashboard;
  match: (p: string) => boolean;
  badge?: "uncategorized";
};

const PRIMARY_NAV: NavItem[] = [
  {
    href: "/",
    label: "סקירה",
    Icon: LayoutDashboard,
    match: (p) => p === "/",
  },
  {
    href: "/budget",
    label: "תקציב",
    Icon: Wallet,
    match: (p) => p.startsWith("/budget"),
  },
  {
    href: "/transactions",
    label: "עסקאות",
    Icon: ArrowLeftRight,
    match: (p) => p.startsWith("/transactions"),
    badge: "uncategorized",
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { data: home } = useQuery({
    queryKey: ["home"],
    queryFn: getHome,
    staleTime: 60_000,
  });
  const uncategorized = home?.needsAttention?.uncategorized ?? 0;

  return (
    <Sidebar collapsible="icon" side="right" variant="floating">
      <SidebarHeader className="px-3 pb-1 pt-3">
        <Link
          href="/"
          className="-mx-1 flex items-center gap-2.5 rounded-lg px-1 py-1 transition-colors duration-200 hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
        >
          <img
            src="/logo_lightmode.svg"
            alt="Spent"
            className="h-7 w-auto shrink-0 dark:hidden"
          />
          <img
            src="/logo_darkmode.svg"
            alt="Spent"
            className="hidden h-7 w-auto shrink-0 dark:block"
          />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="font-serif text-[17px] font-semibold leading-tight tracking-tight">
              Spent
            </div>
            <div className="mt-px text-[10px] font-semibold leading-tight tracking-[0.08em] text-muted-foreground">
              הכסף שלך · קוד פתוח
            </div>
          </div>
        </Link>
        <WorkspaceSwitcher />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarCashflow />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>ניווט</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {PRIMARY_NAV.map((item) => {
                const showBadge =
                  item.badge === "uncategorized" && uncategorized > 0;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={
                        <Link href={item.href}>
                          <item.Icon />
                          <span>{item.label}</span>
                          {showBadge && (
                            <span className="ms-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/15 px-1.5 text-[11px] font-semibold tabular-nums text-amber-700 group-data-[collapsible=icon]:hidden dark:text-amber-400">
                              {uncategorized}
                            </span>
                          )}
                        </Link>
                      }
                      isActive={item.match(pathname)}
                      tooltip={
                        showBadge
                          ? `${item.label} · ${uncategorized} ללא קטגוריה`
                          : item.label
                      }
                    />
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={
                <Link href="/settings">
                  <SettingsIcon />
                  <span>הגדרות</span>
                </Link>
              }
              isActive={pathname.startsWith("/settings")}
              tooltip="הגדרות"
            />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="text-muted-foreground"
              render={
                <a
                  href="https://github.com/gadshushan3030/Spent"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Star />
                  <span>כוכב ב-GitHub</span>
                </a>
              }
              tooltip="כוכב ב-GitHub"
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
