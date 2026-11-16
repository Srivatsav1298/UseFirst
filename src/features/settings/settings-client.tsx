"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Download, Loader2, Save, ShieldCheck, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { locales } from "@/i18n";

type Preferences = {
  locale: "en" | "nb";
  currency: string;
  units: "metric" | "imperial";
  notificationFrequency: "off" | "daily" | "weekly";
  dietaryTags: string[];
  householdServings: number;
};

const dietaryOptions = ["vegetarian", "vegan", "gluten-free", "dairy-free", "pescatarian"];

export function SettingsClient({ initial }: { initial: Preferences }) {
  const { t, locale, setLocale } = useI18n();
  const { toast } = useToast();
  const router = useRouter();
  const [prefs, setPrefs] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notificationState, setNotificationState] = useState<NotificationPermission | "unsupported">("default");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (typeof Notification === "undefined") setNotificationState("unsupported");
    else setNotificationState(Notification.permission);
  }, []);

  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPrefs((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(prefs),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error || t("errors.generic"), "error");
        return;
      }
      if (prefs.locale !== locale) setLocale(prefs.locale);
      toast(t("settings.saved"));
      router.refresh();
    } catch {
      toast(t("errors.offline"), "error");
    } finally {
      setSaving(false);
    }
  }

  async function enableNotifications() {
    if (typeof Notification === "undefined") {
      setNotificationState("unsupported");
      return;
    }
    const result = await Notification.requestPermission();
    setNotificationState(result);
    if (result === "granted") toast(t("settings.notificationsEnabled"));
    if (result === "denied") toast(t("settings.notificationsDenied"), "error");
  }

  async function exportData() {
    setExporting(true);
    try {
      const response = await fetch("/api/account/export");
      if (!response.ok) {
        toast(t("errors.generic"), "error");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `use-first-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast(t("errors.offline"), "error");
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password, confirm }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error || t("errors.generic"), "error");
        return;
      }
      toast(t("settings.deleted"));
      router.replace("/welcome");
      router.refresh();
    } catch {
      toast(t("errors.offline"), "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("settings.title")}</h1>
        <p className="mt-1 text-sm text-stone-500">{t("settings.subtitle")}</p>
      </header>

      <Card>
        <h2 className="mb-4 text-base font-semibold">{t("settings.language")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("settings.language")} htmlFor="settings-locale">
            <Select
              id="settings-locale"
              value={prefs.locale}
              onChange={(e) => update("locale", e.target.value as Preferences["locale"])}
            >
              {locales.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("settings.currency")} htmlFor="settings-currency">
            <Input
              id="settings-currency"
              value={prefs.currency}
              maxLength={3}
              onChange={(e) => update("currency", e.target.value.toUpperCase())}
              className="uppercase"
            />
          </Field>
          <Field label={t("settings.units")} htmlFor="settings-units">
            <Select
              id="settings-units"
              value={prefs.units}
              onChange={(e) => update("units", e.target.value as Preferences["units"])}
            >
              <option value="metric">{t("settings.metric")}</option>
              <option value="imperial">{t("settings.imperial")}</option>
            </Select>
          </Field>
          <Field label={t("settings.servings")} htmlFor="settings-servings">
            <Input
              id="settings-servings"
              type="number"
              min="1"
              max="30"
              value={prefs.householdServings}
              onChange={(e) => update("householdServings", Number(e.target.value) || 1)}
            />
          </Field>
        </div>

        <div className="mt-4">
          <p className="mb-1.5 text-sm font-medium text-stone-700">{t("settings.dietary")}</p>
          <div className="flex flex-wrap gap-1.5">
            {dietaryOptions.map((tag) => {
              const active = prefs.dietaryTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    update(
                      "dietaryTags",
                      active ? prefs.dietaryTags.filter((x) => x !== tag) : [...prefs.dietaryTags, tag],
                    )
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize ${
                    active
                      ? "border-forest-600 bg-forest-600 text-white"
                      : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label={t("settings.notifications")} htmlFor="settings-notifications">
            <Select
              id="settings-notifications"
              value={prefs.notificationFrequency}
              onChange={(e) =>
                update("notificationFrequency", e.target.value as Preferences["notificationFrequency"])
              }
            >
              <option value="off">{t("settings.notificationsOff")}</option>
              <option value="daily">{t("settings.notificationsDaily")}</option>
              <option value="weekly">{t("settings.notificationsWeekly")}</option>
            </Select>
          </Field>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={enableNotifications}
              disabled={notificationState === "granted" || notificationState === "unsupported"}
              className="w-full"
            >
              <Bell className="h-4 w-4" />
              {notificationState === "granted"
                ? t("settings.notificationsEnabled")
                : t("settings.enableNotifications")}
            </Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-stone-500">{t("settings.notificationsHint")}</p>
        {notificationState === "denied" ? (
          <p className="mt-1 text-xs font-medium text-red-700">{t("settings.notificationsDenied")}</p>
        ) : null}

        <div className="mt-5 flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t("common.save")}
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold">{t("settings.export")}</h2>
        <p className="mt-1 text-sm text-stone-500">{t("settings.exportHint")}</p>
        <Button variant="outline" className="mt-3" onClick={exportData} disabled={exporting}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {t("settings.export")}
        </Button>
      </Card>

      <Card>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <ShieldCheck className="h-4 w-4 text-forest-600" aria-hidden="true" />
          {t("settings.privacyTitle")}
        </h2>
        <p className="mt-1 text-sm text-stone-600">{t("settings.privacyBody")}</p>
      </Card>

      <Card className="border-red-100">
        <h2 className="text-base font-semibold text-red-800">{t("settings.deleteAccount")}</h2>
        <p className="mt-1 text-sm text-stone-600">{t("settings.deleteHint")}</p>
        <Button variant="dangerSoft" className="mt-3" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="h-4 w-4" /> {t("settings.deleteAccount")}
        </Button>
      </Card>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t("settings.deleteAccount")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={deleteAccount}
              disabled={deleting || confirm !== "DELETE" || !password}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {t("common.delete")}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-stone-600">{t("settings.deleteHint")}</p>
          <Field label={t("auth.password")} htmlFor="delete-password">
            <Input
              id="delete-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <Field label={t("settings.deleteConfirm")} htmlFor="delete-confirm">
            <Input id="delete-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
