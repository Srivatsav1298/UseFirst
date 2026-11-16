"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Copy, Leaf, Loader2, Users } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export function OnboardingForm({ userName }: { userName: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function createHousehold(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/households", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || t("errors.generic"));
        return;
      }
      setHouseholdId(data.household.id);
      setStep(2);
    } catch {
      setError(t("errors.offline"));
    } finally {
      setBusy(false);
    }
  }

  async function createInvite() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/households/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email || undefined, role: "member" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || t("errors.generic"));
        return;
      }
      setInviteUrl(data.url);
    } catch {
      setError(t("errors.offline"));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-warmwhite px-4 py-10">
      <div className="mb-8 flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-600 text-white">
          <Leaf className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="font-bold tracking-widest text-forest-900">USE FIRST</span>
      </div>

      <div className="mb-6 w-full max-w-md">
        <div className="mb-2 flex justify-between text-xs font-medium text-stone-500">
          <span>{t("onboarding.step", { step, total: 2 })}</span>
          <span>{userName}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-stone-200">
          <div className="h-full rounded-full bg-forest-600 transition-all" style={{ width: step === 1 ? "50%" : "100%" }} />
        </div>
      </div>

      <Card className="w-full max-w-md p-6 sm:p-8">
        {step === 1 ? (
          <form onSubmit={createHousehold} className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t("onboarding.householdTitle")}</h1>
              <p className="mt-1.5 text-sm text-stone-500">{t("onboarding.householdHint")}</p>
            </div>
            <Field label={t("onboarding.householdName")} htmlFor="household-name">
              <Input
                id="household-name"
                autoFocus
                required
                minLength={2}
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="The Smiths"
              />
            </Field>
            {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
            <Button type="submit" size="lg" className="w-full" disabled={busy || name.trim().length < 2}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {t("onboarding.createHousehold")}
            </Button>
          </form>
        ) : (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t("onboarding.inviteTitle")}</h1>
              <p className="mt-1.5 text-sm text-stone-500">{t("onboarding.inviteHint")}</p>
            </div>
            <Field label={t("household.inviteEmail")} htmlFor="invite-email">
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </Field>
            {inviteUrl ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-stone-700">{t("household.inviteLink")}</p>
                <div className="flex gap-2">
                  <Input readOnly value={inviteUrl} aria-label={t("household.inviteLink")} className="text-xs" />
                  <Button variant="secondary" onClick={copy} aria-label={t("common.copy")}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-stone-500">{t("household.inviteCreated")}</p>
              </div>
            ) : (
              <Button variant="secondary" onClick={createInvite} disabled={busy} className="w-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                {t("household.createInvite")}
              </Button>
            )}
            {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
            <div className="flex flex-col gap-2">
              <Button
                size="lg"
                className="w-full"
                onClick={() => {
                  router.replace("/");
                  router.refresh();
                }}
              >
                {t("onboarding.finish")}
              </Button>
              <Button variant="ghost" onClick={() => { router.replace("/"); router.refresh(); }}>
                {t("common.skip")}
              </Button>
            </div>
          </div>
        )}
      </Card>
      {householdId ? <p className="mt-4 text-xs text-stone-400">{t("onboarding.inviteHint")}</p> : null}
    </div>
  );
}
