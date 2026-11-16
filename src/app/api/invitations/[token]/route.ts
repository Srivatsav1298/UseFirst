import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/database";
import { householdInvitations, households, users } from "@/lib/database/schema";
import { hashToken } from "@/lib/auth/session";
import { handle, ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    const { token } = await context.params;
    const database = await db();
    const rows = await database
      .select({
        id: householdInvitations.id,
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
    if (!invitation) return ok({ valid: false });
    return ok({
      valid: true,
      householdName: invitation.householdName,
      inviterName: invitation.inviterName,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    });
  });
}
