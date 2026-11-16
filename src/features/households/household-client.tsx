"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Mail, Shield, Trash2, UserPlus, Users } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, Badge } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { formatDate } from "@/lib/date-recognition/parse";

type Member = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  joinedAt: string | Date;
};

type Invitation = {
  id: string;
  role: "admin" | "member";
  email: string | null;
  expiresAt: string | Date;
  acceptedAt: string | Date | null;
  createdAt: string | Date;
};

type Activity = {
  id: string;
  action: string;
  createdAt: string | Date;
  userName: string | null;
};

export function HouseholdClient({
  household,
  currentUserId,
  members,
  invitations,
  activity,
  canManage,
}: {
  household: { id: string; name: string; role: "owner" | "admin" | "member" };
  currentUserId: string;
  members: Member[];
  invitations: Invitation[];
  activity: Activity[];
  canManage: boolean;
}) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const router = useRouter();
  const [name, setName] = useState(household.name);
  const [renaming, setRenaming] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function rename(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || name.trim() === household.name) return;
    setRenaming(true);
    try {
      const response = await fetch("/api/households/current", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error || t("errors.generic"), "error");
        return;
      }
      toast(t("common.saved"));
      router.refresh();
    } catch {
      toast(t("errors.offline"), "error");
    } finally {
      setRenaming(false);
    }
  }

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setInviting(true);
    try {
      const response = await fetch("/api/households/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() || undefined, role }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error || t("errors.generic"), "error");
        return;
      }
      setInviteLink(data.url);
      setEmail("");
      toast(t("household.inviteCreated"));
      router.refresh();
    } catch {
      toast(t("errors.offline"), "error");
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(member: Member, next: "admin" | "member") {
    setBusyId(member.id);
    try {
      const response = await fetch(`/api/households/members/${member.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: next }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error || t("errors.generic"), "error");
        return;
      }
      toast(t("common.saved"));
      router.refresh();
    } catch {
      toast(t("errors.offline"), "error");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(member: Member) {
    if (!window.confirm(t("household.removeConfirm"))) return;
    setBusyId(member.id);
    try {
      const response = await fetch(`/api/households/members/${member.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error || t("errors.generic"), "error");
        return;
      }
      toast(t("common.saved"));
      router.refresh();
    } catch {
      toast(t("errors.offline"), "error");
    } finally {
      setBusyId(null);
    }
  }

  async function copyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast(t("common.copied"));
    } catch {
      toast(inviteLink, "info");
    }
  }

  function canEditRole(member: Member): boolean {
    if (!canManage || member.id === currentUserId || member.role === "owner") return false;
    if (household.role === "owner") return true;
    return household.role === "admin" && member.role === "member";
  }

  function canRemove(member: Member): boolean {
    if (!canManage || member.id === currentUserId || member.role === "owner") return false;
    if (household.role === "owner") return true;
    return household.role === "admin" && member.role === "member";
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("household.title")}</h1>
        <p className="mt-1 text-sm text-stone-500">{t("household.subtitle")}</p>
      </header>

      <Card>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <Users className="h-4 w-4 text-forest-600" aria-hidden="true" />
          {t("household.name")}
        </h2>
        {canManage ? (
          <form onSubmit={rename} className="flex flex-col gap-2 sm:flex-row">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label={t("household.name")} />
            <Button type="submit" disabled={renaming || !name.trim() || name.trim() === household.name}>
              {renaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {t("household.rename")}
            </Button>
          </form>
        ) : (
          <p className="text-sm font-medium">{household.name}</p>
        )}
        <p className="mt-2 text-xs text-stone-500">{t("household.roleHint")}</p>
      </Card>

      <Card>
        <h2 className="mb-3 text-base font-semibold">{t("household.members")}</h2>
        <ul className="divide-y divide-stone-100">
          {members.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest-50 text-sm font-semibold text-forest-700">
                {member.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {member.name}
                  {member.id === currentUserId ? <span className="ml-1 text-xs text-stone-400">({t("household.you")})</span> : null}
                </p>
                <p className="truncate text-xs text-stone-500">{member.email}</p>
              </div>
              {canEditRole(member) ? (
                <Select
                  value={member.role}
                  onChange={(e) => changeRole(member, e.target.value as "admin" | "member")}
                  disabled={busyId === member.id}
                  aria-label={t("household.changeRole")}
                  className="h-9 w-auto py-1 text-xs"
                >
                  <option value="member">{t("household.role.member")}</option>
                  <option value="admin">{t("household.role.admin")}</option>
                </Select>
              ) : (
                <Badge tone={member.role === "owner" ? "success" : "neutral"}>
                  <Shield className="h-3 w-3" /> {t(`household.role.${member.role}`)}
                </Badge>
              )}
              {canRemove(member) ? (
                <button
                  type="button"
                  onClick={() => remove(member)}
                  disabled={busyId === member.id}
                  aria-label={t("household.remove")}
                  className="tap-target flex items-center justify-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600"
                >
                  {busyId === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      {canManage ? (
        <Card>
          <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
            <UserPlus className="h-4 w-4 text-forest-600" aria-hidden="true" />
            {t("household.invite")}
          </h2>
          <p className="mb-4 text-sm text-stone-500">{t("household.inviteHint")}</p>
          <form onSubmit={invite} className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field label={t("household.inviteEmail")} htmlFor="invite-email">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
                  <Input
                    id="invite-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    placeholder="name@example.com"
                  />
                </div>
              </Field>
            </div>
            <Field label={t("household.changeRole")} htmlFor="invite-role">
              <Select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
                <option value="member">{t("household.role.member")}</option>
                <option value="admin">{t("household.role.admin")}</option>
              </Select>
            </Field>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={inviting}>
                {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                {t("household.createInvite")}
              </Button>
            </div>
          </form>

          {inviteLink ? (
            <div className="mt-4 rounded-xl border border-forest-100 bg-forest-50 p-3">
              <p className="text-xs font-medium text-forest-900">{t("household.inviteLink")}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-2 py-1.5 text-xs">{inviteLink}</code>
                <Button size="sm" variant="secondary" onClick={copyLink}>
                  <Copy className="h-4 w-4" /> {t("common.copy")}
                </Button>
              </div>
              <p className="mt-1.5 text-xs text-forest-800">{t("household.inviteCreated")}</p>
            </div>
          ) : null}

          {invitations.length ? (
            <ul className="mt-4 divide-y divide-stone-100 border-t border-stone-100 pt-2">
              {invitations.map((invitation) => {
                const accepted = Boolean(invitation.acceptedAt);
                const expired = new Date(invitation.expiresAt).getTime() < Date.now();
                return (
                  <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{invitation.email || t("household.inviteLink")}</p>
                      <p className="text-stone-500">
                        {t(`household.role.${invitation.role}`)} · {t("household.expires")}{" "}
                        {formatDate(new Date(invitation.expiresAt).toISOString().slice(0, 10), locale)}
                      </p>
                    </div>
                    <Badge tone={accepted ? "success" : expired ? "neutral" : "info"}>
                      {accepted ? t("household.accepted") : expired ? t("common.none") : t("household.pending")}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-3 text-base font-semibold">{t("household.activity")}</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-stone-500">{t("household.noActivity")}</p>
        ) : (
          <ol className="space-y-2.5">
            {activity.map((event) => (
              <li key={event.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-forest-300" aria-hidden="true" />
                <div>
                  <p className="font-medium">{event.action.replaceAll(".", " · ")}</p>
                  <p className="text-xs text-stone-500">
                    {event.userName || t("common.unknown")} ·{" "}
                    {formatDate(new Date(event.createdAt).toISOString().slice(0, 10), locale)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
