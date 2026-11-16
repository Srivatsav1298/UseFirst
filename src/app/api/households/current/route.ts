import { eq } from "drizzle-orm";
import { db } from "@/lib/database";
import { householdMembers, households, users } from "@/lib/database/schema";
import { requireMembership } from "@/lib/permissions";
import { assertSameOrigin, handle, ok, ApiError } from "@/lib/api/http";
import { householdRenameSchema } from "@/lib/validation/schemas";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const membership = await requireMembership();
    const database = await db();
    const members = await database
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: householdMembers.role,
        joinedAt: householdMembers.joinedAt,
      })
      .from(householdMembers)
      .innerJoin(users, eq(users.id, householdMembers.userId))
      .where(eq(householdMembers.householdId, membership.householdId));
    return ok({
      household: { id: membership.householdId, name: membership.householdName, role: membership.role },
      members,
      currentUserId: membership.user.id,
    });
  });
}

export async function PATCH(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    const membership = await requireMembership();
    if (membership.role === "member") throw new ApiError(403, "Only owners and administrators can rename the household.", "forbidden");
    const body = householdRenameSchema.parse(await request.json());
    const database = await db();
    await database
      .update(households)
      .set({ name: body.name, updatedAt: new Date() })
      .where(eq(households.id, membership.householdId));
    await recordAudit({
      householdId: membership.householdId,
      userId: membership.user.id,
      action: "household.renamed",
      entity: "household",
      entityId: membership.householdId,
    });
    return ok({ household: { id: membership.householdId, name: body.name } });
  });
}
