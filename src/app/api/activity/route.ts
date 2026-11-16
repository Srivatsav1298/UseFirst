import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/database";
import { auditEvents, users } from "@/lib/database/schema";
import { requireMembership } from "@/lib/permissions";
import { handle, ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const membership = await requireMembership();
    const database = await db();
    const rows = await database
      .select({
        id: auditEvents.id,
        action: auditEvents.action,
        entity: auditEvents.entity,
        entityId: auditEvents.entityId,
        meta: auditEvents.meta,
        createdAt: auditEvents.createdAt,
        userName: users.name,
      })
      .from(auditEvents)
      .leftJoin(users, eq(users.id, auditEvents.userId))
      .where(eq(auditEvents.householdId, membership.householdId))
      .orderBy(desc(auditEvents.createdAt))
      .limit(60);
    return ok({ events: rows });
  });
}
