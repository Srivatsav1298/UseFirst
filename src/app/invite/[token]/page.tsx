import Link from "next/link";
import { and, eq, gt, isNull } from "drizzle-orm";
import { Leaf, Users } from "lucide-react";
import { db } from "@/lib/database";
import { householdInvitations, households, users } from "@/lib/database/schema";
import { hashToken, getCurrentUser } from "@/lib/auth/session";
import { translate } from "@/i18n";
import { getServerLocale } from "@/lib/locale";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InviteJoin } from "@/features/households/invite-join";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const locale = await getServerLocale();
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
  const database = await db();
  const rows = await database
    .select({
      householdName: households.name,
      inviterName: users.name,
      role: householdInvitations.role,
      expiresAt: householdInvitations.expiresAt,
    })
    .from(householdInvitations)
    .innerJoin(households, eq(households.id, householdInvitations.householdId))
    .innerJoin(users, eq(users.id, householdInvitations.createdBy))
    .where(
      and(
        eq(householdInvitations.tokenHash, hashToken(token)),
        isNull(householdInvitations.acceptedAt),
        gt(householdInvitations.expiresAt, new Date()),
      ),
    )
    .limit(1);
  const invitation = rows[0];
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-warmwhite px-4 py-10">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-600 text-white">
          <Leaf className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="font-bold tracking-widest text-forest-900">USE FIRST</span>
      </Link>
      <Card className="w-full max-w-md p-6 text-center sm:p-8">
        {!invitation ? (
          <>
            <h1 className="text-xl font-semibold">{t("household.inviteInvalid")}</h1>
            <p className="mt-2 text-sm text-stone-500">{t("auth.intro")}</p>
            <Link href="/welcome" className="mt-6 inline-block">
              <Button>{t("auth.signIn")}</Button>
            </Link>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-50 text-forest-700">
              <Users className="h-7 w-7" aria-hidden="true" />
            </div>
            <h1 className="text-xl font-semibold">{t("household.joinTitle", { name: invitation.householdName })}</h1>
            <p className="mt-2 text-sm text-stone-500">{t("household.joinBody")}</p>
            <p className="mt-3 text-xs text-stone-400">
              {invitation.inviterName} · {t(`household.role.${invitation.role}` as Parameters<typeof t>[0])}
            </p>
            <div className="mt-6">
              {!user ? (
                <Link href={`/welcome?next=/invite/${token}`}>
                  <Button className="w-full" size="lg">
                    {t("auth.signIn")}
                  </Button>
                </Link>
              ) : (
                <InviteJoin token={token} />
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
