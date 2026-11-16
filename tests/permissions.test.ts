import { describe, expect, it } from "vitest";
import { canChangeRole, canManageHousehold, canRemoveMember } from "@/lib/permissions";

describe("household role rules", () => {
  it("lets owners and admins manage the household", () => {
    expect(canManageHousehold("owner")).toBe(true);
    expect(canManageHousehold("admin")).toBe(true);
    expect(canManageHousehold("member")).toBe(false);
  });

  it("lets owners assign any role", () => {
    expect(canChangeRole("owner", "admin", "owner")).toBe(true);
    expect(canChangeRole("owner", "member", "admin")).toBe(true);
  });

  it("stops admins from creating or changing owners", () => {
    expect(canChangeRole("admin", "member", "owner")).toBe(false);
    expect(canChangeRole("admin", "owner", "member")).toBe(false);
    expect(canChangeRole("admin", "member", "admin")).toBe(true);
  });

  it("never lets members change roles", () => {
    expect(canChangeRole("member", "member", "admin")).toBe(false);
  });

  it("protects owners from removal", () => {
    expect(canRemoveMember("owner", "owner")).toBe(false);
    expect(canRemoveMember("owner", "admin")).toBe(true);
    expect(canRemoveMember("admin", "owner")).toBe(false);
    expect(canRemoveMember("admin", "member")).toBe(true);
    expect(canRemoveMember("admin", "admin")).toBe(false);
    expect(canRemoveMember("member", "member")).toBe(false);
  });
});
