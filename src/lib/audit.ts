import { db } from "@/lib/database";
import { auditEvents } from "@/lib/database/schema";

export async function recordAudit(input: {
  householdId?: string | null;
  userId: string;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    const database = await db();
    await database.insert(auditEvents).values({
      id: crypto.randomUUID(),
      householdId: input.householdId ?? null,
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      meta: input.meta ?? {},
    });
  } catch (error) {
    console.error("Audit write failed", error instanceof Error ? error.message : "unknown");
  }
}
