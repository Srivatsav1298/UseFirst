import { and, eq } from "drizzle-orm";
import { db } from "@/lib/database";
import { householdMembers } from "@/lib/database/schema";
import { requireMembership, canChangeRole, canRemoveMember } from "@/lib/permissions";
import { assertSameOrigin, handle, ok, ApiError } from "@/lib/api/http";
import { memberRoleSchema } from "@/lib/validation/schemas";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

async function findTarget(householdId: string, memberId: string) {
  const database = await db();
  const rows = await database
    .select()
    .from(householdMembers)
    .where(and(eq(householdMembers.id, memberId), eq(householdMembers.householdId, householdId)))
    .limit(1);
  if (!rows[0]) throw new ApiError(404, "Member not found.", "not_found");
  return rows[0];
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(request);
    const { id } = await context.params;
    const membership = await requireMembership();
    const body = memberRoleSchema.parse(await request.json());
    const target = await findTarget(membership.householdId, id);
    if (target.userId === membership.user.id) {
      throw new ApiError(400, "You cannot change your own role.", "invalid_role_change");
    }
    if (!canChangeRole(membership.role, target.role, body.role)) {
      throw new ApiError(403, "You cannot assign that role.", "forbidden");
    }
    const database = await db();
    await database.update(householdMembers).set({ role: body.role }).where(eq(householdMembers.id, id));
    await recordAudit({
      householdId: membership.householdId,
      userId: membership.user.id,
      action: "member.role_changed",
      entity: "member",
      entityId: id,
      meta: { from: target.role, to: body.role },
    });
    return ok({ success: true });
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(request);
    const { id } = await context.params;
    const membership = await requireMembership();
    const target = await findTarget(membership.householdId, id);
    if (target.userId === membership.user.id) {
      throw new ApiError(400, "Use settings to delete your own account.", "invalid_removal");
    }
    if (!canRemoveMember(membership.role, target.role)) {
      throw new ApiError(403, "You cannot remove that member.", "forbidden");
    }
    const database = await db();
    await database.delete(householdMembers).where(eq(householdMembers.id, id));
    await recordAudit({
      householdId: membership.householdId,
      userId: membership.user.id,
      action: "member.removed",
      entity: "member",
      entityId: id,
    });
    return ok({ success: true });
  });
}
