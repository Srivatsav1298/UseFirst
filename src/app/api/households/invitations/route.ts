import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/database";
import { householdInvitations } from "@/lib/database/schema";
import { requireMembership, canManageHousehold } from "@/lib/permissions";
import { assertSameOrigin, handle, ok, ApiError } from "@/lib/api/http";
import { invitationCreateSchema } from "@/lib/validation/schemas";
import { hashToken } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    const membership = await requireMembership();
    if (!canManageHousehold(membership.role)) {
      throw new ApiError(403, "Only owners and administrators can invite members.", "forbidden");
    }
    const body = invitationCreateSchema.parse(await request.json());
    const database = await db();

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const id = crypto.randomUUID();
    await database.insert(householdInvitations).values({
      id,
      householdId: membership.householdId,
      tokenHash: hashToken(token),
      email: body.email ?? null,
      role: body.role,
      createdBy: membership.user.id,
      expiresAt,
    });
    await recordAudit({
      householdId: membership.householdId,
      userId: membership.user.id,
      action: "invitation.created",
      entity: "invitation",
      entityId: id,
    });

    const base = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    return ok(
      {
        id,
        url: `${base.replace(/\/$/, "")}/invite/${token}`,
        expiresAt,
        role: body.role,
      },
      { status: 201 },
    );
  });
}

export async function GET() {
  return handle(async () => {
    const membership = await requireMembership();
    if (!canManageHousehold(membership.role)) throw new ApiError(403, "Forbidden", "forbidden");
    const database = await db();
    const rows = await database
      .select({
        id: householdInvitations.id,
        role: householdInvitations.role,
        email: householdInvitations.email,
        expiresAt: householdInvitations.expiresAt,
        acceptedAt: householdInvitations.acceptedAt,
        createdAt: householdInvitations.createdAt,
      })
      .from(householdInvitations)
      .where(eq(householdInvitations.householdId, membership.householdId));
    return ok({ invitations: rows });
  });
}
