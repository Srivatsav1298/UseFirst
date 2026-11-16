import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/database";
import { householdInvitations, householdMembers } from "@/lib/database/schema";
import { requireUser, hashToken } from "@/lib/auth/session";
import { assertSameOrigin, handle, ok, ApiError } from "@/lib/api/http";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    assertSameOrigin(request);
    const { token } = await context.params;
    const user = await requireUser();
    const database = await db();

    const result = await database.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(householdInvitations)
        .where(
          and(
            eq(householdInvitations.tokenHash, hashToken(token)),
            isNull(householdInvitations.acceptedAt),
            gt(householdInvitations.expiresAt, new Date()),
          ),
        )
        .limit(1);
      const invitation = rows[0];
      if (!invitation) throw new ApiError(404, "This invitation is invalid, expired or already used.", "invalid_invitation");

      const existing = await tx
        .select()
        .from(householdMembers)
        .where(eq(householdMembers.userId, user.id))
        .limit(1);
      if (existing.length) {
        if (existing[0].householdId === invitation.householdId) {
          return { householdId: invitation.householdId, alreadyMember: true };
        }
        throw new ApiError(409, "You already belong to another household.", "already_member");
      }

      await tx.insert(householdMembers).values({
        id: crypto.randomUUID(),
        householdId: invitation.householdId,
        userId: user.id,
        role: invitation.role,
      });
      await tx
        .update(householdInvitations)
        .set({ acceptedAt: new Date(), acceptedBy: user.id })
        .where(eq(householdInvitations.id, invitation.id));
      return { householdId: invitation.householdId, alreadyMember: false };
    });

    await recordAudit({
      householdId: result.householdId,
      userId: user.id,
      action: "invitation.accepted",
      entity: "household",
      entityId: result.householdId,
    });
    return ok({ householdId: result.householdId, alreadyMember: result.alreadyMember });
  });
}
