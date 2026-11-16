import { eq } from "drizzle-orm";
import { db } from "@/lib/database";
import { householdMembers, households, shoppingLists } from "@/lib/database/schema";
import { requireUser } from "@/lib/auth/session";
import { assertSameOrigin, handle, ok, ApiError } from "@/lib/api/http";
import { householdCreateSchema } from "@/lib/validation/schemas";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    const user = await requireUser();
    const body = householdCreateSchema.parse(await request.json());
    const database = await db();

    const existing = await database
      .select({ id: householdMembers.id })
      .from(householdMembers)
      .where(eq(householdMembers.userId, user.id))
      .limit(1);
    if (existing.length) throw new ApiError(409, "You already belong to a household.", "already_member");

    const householdId = crypto.randomUUID();
    await database.transaction(async (tx) => {
      await tx.insert(households).values({ id: householdId, name: body.name, ownerId: user.id });
      await tx.insert(householdMembers).values({
        id: crypto.randomUUID(),
        householdId,
        userId: user.id,
        role: "owner",
      });
      await tx.insert(shoppingLists).values({
        id: crypto.randomUUID(),
        householdId,
        name: "Shopping list",
      });
    });
    await recordAudit({ householdId, userId: user.id, action: "household.created", entity: "household", entityId: householdId });

    return ok({ household: { id: householdId, name: body.name, role: "owner" } }, { status: 201 });
  });
}
