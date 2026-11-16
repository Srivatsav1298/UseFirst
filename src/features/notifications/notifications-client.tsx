"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, CheckCheck, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, Badge } from "@/components/ui/card";
import { relativeDate } from "@/lib/utils";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | Date | null;
  createdAt: string | Date;
};

export function NotificationsClient({ initial }: { initial: Notification[] }) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function markAll() {
    setBusy(true);
    try {
      const response = await fetch("/api/notifications", { method: "PATCH" });
      if (!response.ok) {
        toast(t("errors.generic"), "error");
        return;
      }
      setItems((current) => current.map((item) => ({ ...item, readAt: new Date().toISOString() })));
      router.refresh();
    } catch {
      toast(t("errors.offline"), "error");
    } finally {
      setBusy(false);
    }
  }

  const unread = items.filter((item) => !item.readAt).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("notifications.title")}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {unread ? t("notifications.attention", { count: unread }) : t("notifications.empty")}
          </p>
        </div>
        {unread ? (
          <Button variant="outline" onClick={markAll} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
            {t("notifications.markRead")}
          </Button>
        ) : null}
      </header>

      {items.length === 0 ? (
        <Card className="py-10 text-center">
          <BellOff className="mx-auto h-8 w-8 text-stone-300" aria-hidden="true" />
          <p className="mt-2 text-sm text-stone-500">{t("notifications.empty")}</p>
        </Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-stone-100">
            {items.map((item) => (
              <li key={item.id} className="flex gap-3 px-4 py-3.5">
                <span
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    item.readAt ? "bg-stone-100 text-stone-400" : "bg-forest-50 text-forest-700"
                  }`}
                  aria-hidden="true"
                >
                  <Bell className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{item.title}</p>
                    {!item.readAt ? <Badge tone="info">{t("notifications.new")}</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-sm text-stone-600">{item.body}</p>
                  <p className="mt-1 text-xs text-stone-400">
                    {relativeDate(new Date(item.createdAt).toISOString(), locale)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
