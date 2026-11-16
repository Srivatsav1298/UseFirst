"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Leaf, Loader2, ShieldCheck, Sparkles, Users } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { locales } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export function AuthForm({ next }: { next?: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          mode === "login" ? { email, password } : { name, email, password, locale },
        ),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.code === "email_exists") setError(t("auth.exists"));
        else if (data.code === "invalid_credentials") setError(t("auth.invalid"));
        else if (data.code === "rate_limited") setError(t("errors.rate"));
        else if (data.code === "validation_error") setError(t("errors.generic"));
        else setError(data.error || t("errors.generic"));
        return;
      }
      router.replace(next || "/onboarding");
      router.refresh();
    } catch {
      setError(t("errors.offline"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-warmwhite">
      <div className="mx-auto grid min-h-dvh max-w-6xl lg:grid-cols-[1.1fr_1fr]">
        <section className="relative hidden flex-col justify-between overflow-hidden bg-forest-800 p-10 text-white lg:flex">
          <div className="absolute inset-0 opacity-20" aria-hidden="true">
            <div className="absolute -left-24 top-24 h-80 w-80 rounded-full bg-sage-300 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-forest-400 blur-3xl" />
          </div>
          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                <Leaf className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="text-lg font-bold tracking-widest">USE FIRST</span>
            </div>
            <h1 className="mt-16 max-w-md text-4xl font-bold leading-tight">{t("app.tagline")}</h1>
            <p className="mt-4 max-w-md text-forest-50/90">{t("auth.intro")}</p>
            <ul className="mt-10 space-y-4 text-sm text-forest-50/90">
              <li className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 shrink-0 text-sage-200" aria-hidden="true" />
                See what to use first, before it is wasted.
              </li>
              <li className="flex items-center gap-3">
                <Users className="h-5 w-5 shrink-0 text-sage-200" aria-hidden="true" />
                Share one live inventory with your household.
              </li>
              <li className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 shrink-0 text-sage-200" aria-hidden="true" />
                Free, private and self-hostable. No ads, no selling data.
              </li>
            </ul>
          </div>
          <p className="relative text-xs text-forest-100/70">{t("auth.privacy")}</p>
        </section>

        <section className="flex flex-col justify-center px-5 py-10 sm:px-10">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest-600 text-white">
                <Leaf className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="font-bold tracking-widest text-forest-900">USE FIRST</span>
            </div>
            <LanguagePicker />
          </div>
          <div className="hidden justify-end lg:flex">
            <LanguagePicker />
          </div>

          <Card className="mt-6 w-full max-w-md border-stone-200 p-6 sm:p-8 lg:mx-auto">
            <h2 className="text-2xl font-bold tracking-tight">
              {mode === "login" ? t("auth.signIn") : t("auth.createAccount")}
            </h2>
            <p className="mt-1.5 text-sm text-stone-500">{t("auth.intro")}</p>

            <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
              {mode === "register" ? (
                <Field label={t("auth.name")} htmlFor="name">
                  <Input
                    id="name"
                    name="name"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
              ) : null}
              <Field label={t("auth.email")} htmlFor="email">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label={t("auth.password")} htmlFor="password" hint={mode === "register" ? t("auth.passwordHint") : undefined}>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  minLength={mode === "register" ? 8 : 1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>

              {error ? (
                <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {error}
                </p>
              ) : null}

              <Button type="submit" className="w-full" size="lg" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {busy
                  ? mode === "login"
                    ? t("auth.signingIn")
                    : t("auth.creating")
                  : mode === "login"
                    ? t("auth.signIn")
                    : t("auth.createAccount")}
              </Button>
            </form>

            <div className="mt-5 text-center text-sm text-stone-500">
              {mode === "login" ? t("auth.noAccount") : t("auth.haveAccount")}{" "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setError(null);
                }}
                className="font-semibold text-forest-700 hover:underline"
              >
                {mode === "login" ? t("auth.createAccount") : t("auth.signIn")}
              </button>
            </div>
          </Card>
          <p className="mx-auto mt-6 max-w-md text-center text-xs text-stone-400">{t("auth.privacy")}</p>
        </section>
      </div>
    </div>
  );
}

function LanguagePicker() {
  const { locale, setLocale } = useI18n();
  return (
    <label className="flex items-center gap-2 text-xs text-stone-500">
      <span className="sr-only">Language</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as "en" | "nb")}
        className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs text-stone-700"
      >
        {locales.map((item) => (
          <option key={item.code} value={item.code}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}
