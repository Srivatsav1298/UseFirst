import { and, eq } from "drizzle-orm";
import { db } from "@/lib/database";
import { householdMembers, households } from "@/lib/database/schema";
import { requireUser, type SessionUser } from "@/lib/auth/session";

export type Role = "owner" | "admin" | "member";

export type Membership = {
  user: SessionUser;
  householdId: string;
  householdName: string;
  role: Role;
};

export class PermissionError extends Error {
  status = 403;
}

export async function getMembership(userId: string): Promise<Membership | null> {
  const database = await db();
  const rows = await database
    .select({
      householdId: households.id,
      householdName: households.name,
      role: householdMembers.role,
    })
    .from(householdMembers)
    .innerJoin(households, eq(households.id, householdMembers.householdId))
    .where(eq(householdMembers.userId, userId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const user = await requireUser();
  return { user, householdId: row.householdId, householdName: row.householdName, role: row.role };
}

export async function requireMembership(): Promise<Membership> {
  const user = await requireUser();
  const membership = await getMembership(user.id);
  if (!membership) throw new PermissionError("No household membership");
  return membership;
}

export function canManageHousehold(role: Role): boolean {
  return role === "owner" || role === "admin";
}

export function canChangeRole(actor: Role, target: Role, next: Role): boolean {
  if (actor === "owner") return true;
  if (actor !== "admin") return false;
  if (target === "owner") return false;
  return next !== "owner";
}

export function canRemoveMember(actor: Role, target: Role): boolean {
  if (actor === "owner") return target !== "owner";
  if (actor === "admin") return target === "member";
  return false;
}

export async function assertInventoryAccess(householdId: string, inventoryId: string) {
  const database = await db();
  const { inventory } = await import("@/lib/database/schema");
  const rows = await database
    .select()
    .from(inventory)
    .where(and(eq(inventory.id, inventoryId), eq(inventory.householdId, householdId)))
    .limit(1);
  if (!rows[0]) throw new PermissionError("Inventory item not found in your household");
  return rows[0];
}
