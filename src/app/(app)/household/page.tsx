import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/database";
import {
  auditEvents,
  householdInvitations,
  householdMembers,
  users,
} from "@/lib/database/schema";
import { canManageHousehold, requireMembership } from "@/lib/permissions";
import { HouseholdClient } from "@/features/households/household-client";

export const dynamic = "force-dynamic";

export default async function HouseholdPage() {
  const membership = await requireMembership();
  const database = await db();
  const manage = canManageHousehold(membership.role);

  const [memberRows, invitationRows, activityRows] = await Promise.all([
    database
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: householdMembers.role,
        joinedAt: householdMembers.joinedAt,
      })
      .from(householdMembers)
      .innerJoin(users, eq(users.id, householdMembers.userId))
      .where(eq(householdMembers.householdId, membership.householdId))
      .orderBy(householdMembers.joinedAt),
    manage
      ? database
          .select({
            id: householdInvitations.id,
            role: householdInvitations.role,
            email: householdInvitations.email,
            expiresAt: householdInvitations.expiresAt,
            acceptedAt: householdInvitations.acceptedAt,
            createdAt: householdInvitations.createdAt,
          })
          .from(householdInvitations)
          .where(eq(householdInvitations.householdId, membership.householdId))
          .orderBy(desc(householdInvitations.createdAt))
      : Promise.resolve([]),
    database
      .select({
        id: auditEvents.id,
        action: auditEvents.action,
        createdAt: auditEvents.createdAt,
        userName: users.name,
      })
      .from(auditEvents)
      .leftJoin(users, eq(users.id, auditEvents.userId))
      .where(and(eq(auditEvents.householdId, membership.householdId)))
      .orderBy(desc(auditEvents.createdAt))
      .limit(12),
  ]);

  return (
    <HouseholdClient
      household={{ id: membership.householdId, name: membership.householdName, role: membership.role }}
      currentUserId={membership.user.id}
      members={memberRows}
      invitations={invitationRows}
      activity={activityRows}
      canManage={manage}
    />
  );
}
