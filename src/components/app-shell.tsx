"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChefHat,
  Home,
  ListChecks,
  ScanLine,
  Settings,
  ShoppingBasket,
  Sparkles,
  Users,
  LogOut,
  Leaf,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const primaryNav = [
  { href: "/", key: "nav.home", icon: Home },
  { href: "/scan", key: "nav.scan", icon: ScanLine },
  { href: "/food", key: "nav.food", icon: ShoppingBasket },
  { href: "/meals", key: "nav.meals", icon: ChefHat },
  { href: "/shopping", key: "nav.shopping", icon: ListChecks },
] as const;

const secondaryNav = [
  { href: "/household", key: "nav.household", icon: Users },
  { href: "/insights", key: "nav.insights", icon: Sparkles },
  { href: "/notifications", key: "notifications.title", icon: Bell },
  { href: "/settings", key: "nav.settings", icon: Settings },
] as const;

export function AppShell({
  children,
  userName,
  householdName,
  role,
}: {
  children: ReactNode;
  userName: string;
  householdName: string;
  role: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/welcome");
    router.refresh();
  }

  return (
    <div className="min-h-dvh lg:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>

      <aside className="hidden w-64 shrink-0 border-r border-stone-200/70 bg-white/70 lg:flex lg:flex-col">
        <div className="flex items-center gap-2.5 px-5 py-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest-600 text-white">
            <Leaf className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-bold tracking-wide text-forest-900">USE FIRST</p>
            <p className="truncate text-xs text-stone-500">{householdName}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3" aria-label="Main">
          {primaryNav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-forest-50 text-forest-800" : "text-stone-600 hover:bg-stone-50 hover:text-ink",
                )}
              >
                <item.icon className="h-5 w-5" aria-hidden="true" />
                {t(item.key)}
              </Link>
            );
          })}
          <div className="my-3 border-t border-stone-100" />
          {secondaryNav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-forest-50 text-forest-800" : "text-stone-600 hover:bg-stone-50 hover:text-ink",
                )}
              >
                <item.icon className="h-5 w-5" aria-hidden="true" />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-stone-100 p-4">
          <p className="truncate text-sm font-medium text-ink">{userName}</p>
          <p className="mb-2 text-xs capitalize text-stone-500">{role}</p>
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start px-2">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {t("auth.signOut")}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-stone-200/60 bg-warmwhite/90 px-4 py-3 backdrop-blur lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest-600 text-white">
              <Leaf className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-sm font-bold tracking-wide text-forest-900">USE FIRST</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/notifications" aria-label={t("notifications.title")} className="tap-target flex items-center justify-center rounded-lg text-stone-600 hover:bg-stone-100">
              <Bell className="h-5 w-5" />
            </Link>
            <Link href="/settings" aria-label={t("nav.settings")} className="tap-target flex items-center justify-center rounded-lg text-stone-600 hover:bg-stone-100">
              <Settings className="h-5 w-5" />
            </Link>
          </div>
        </header>

        {!online ? (
          <div className="bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-900" role="status">
            {t("common.offline")}
          </div>
        ) : null}

        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
          {children}
        </main>

        <nav
          className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 backdrop-blur lg:hidden"
          aria-label="Primary"
        >
          <div className="mx-auto grid max-w-lg grid-cols-5">
            {primaryNav.map((item) => {
              const active = pathname === item.href;
              const isScan = item.href === "/scan";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium",
                    active ? "text-forest-700" : "text-stone-500",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-xl",
                      isScan && "bg-forest-600 text-white shadow-sm",
                      active && !isScan && "bg-forest-50",
                    )}
                  >
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  {t(item.key)}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
