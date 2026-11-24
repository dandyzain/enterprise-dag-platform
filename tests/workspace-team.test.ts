import { describe, it, expect } from "vitest";
import { registerUser, type SessionUser } from "@/lib/services/auth-service";
import {
  createInvitation,
  acceptInvitation,
  listMembers,
  previewInvitation,
  updateMemberRole,
  removeMember,
  listInvitations,
  revokeInvitation,
} from "@/lib/services/workspace-service";
import { canAssignRole, hasPermission } from "@/lib/auth/rbac";

async function newOwner(tag: string): Promise<SessionUser> {
  const res = await registerUser(`${tag}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@example.com`, "Password123!", `Owner ${tag}`, `${tag} Inc`);
  return res.session!;
}

describe("Team management & invitations", () => {
  it("invites by link, accepts with the matching account and assigns the role", async () => {
    const owner = await newOwner("inv");
    const inviteeEmail = `invitee_${Date.now()}@example.com`;

    const inv = await createInvitation(owner, inviteeEmail, "MEMBER");
    expect(inv.success).toBe(true);
    if (!inv.success) return;

    expect((await previewInvitation(inv.token))?.workspaceName).toBe(owner.workspaceName);
    expect(await listInvitations(owner.workspaceId)).toHaveLength(1);

    // Wrong account cannot use it
    const stranger = await newOwner("stranger");
    expect((await acceptInvitation(stranger, inv.token)).success).toBe(false);

    // Matching account joins
    const invitee = (await registerUser(inviteeEmail, "Password123!", "Invitee", "Personal")).session!;
    const accepted = await acceptInvitation(invitee, inv.token);
    expect(accepted.success).toBe(true);
    const members = await listMembers(owner.workspaceId);
    expect(members.find((m) => m.email === inviteeEmail)?.role).toBe("MEMBER");

    // Tokens are single-use
    expect((await acceptInvitation(invitee, inv.token)).success).toBe(false);
    expect(await listInvitations(owner.workspaceId)).toHaveLength(0);
  });

  it("applies role hierarchy rules", () => {
    expect(canAssignRole("OWNER", "OWNER")).toBe(true);
    expect(canAssignRole("ADMIN", "OWNER")).toBe(false);
    expect(canAssignRole("ADMIN", "ADMIN")).toBe(false);
    expect(canAssignRole("ADMIN", "MEMBER")).toBe(true);
    // Hierarchy alone would allow it, but members can't manage people at all.
    expect(hasPermission("MEMBER", "member:manage")).toBe(false);
    expect(hasPermission("ADMIN", "member:manage")).toBe(true);
  });

  it("changes roles, protects the last owner and removes members", async () => {
    const owner = await newOwner("roles");
    const email = `teammate_${Date.now()}@example.com`;
    const inv = await createInvitation(owner, email, "VIEWER");
    if (!inv.success) throw new Error(inv.error);
    const mate = (await registerUser(email, "Password123!", "Mate", "Mine")).session!;
    await acceptInvitation(mate, inv.token);

    expect((await updateMemberRole(owner, mate.id, "ADMIN")).success).toBe(true);
    expect((await listMembers(owner.workspaceId)).find((m) => m.userId === mate.id)?.role).toBe("ADMIN");

    // Owners can't demote themselves (and the last owner is protected)
    expect((await updateMemberRole(owner, owner.id, "MEMBER")).success).toBe(false);

    // An admin can't remove the owner
    const asAdmin: SessionUser = { ...mate, workspaceId: owner.workspaceId, role: "ADMIN" };
    expect((await removeMember(asAdmin, owner.id)).success).toBe(false);

    expect((await removeMember(owner, mate.id)).success).toBe(true);
    expect((await listMembers(owner.workspaceId)).some((m) => m.userId === mate.id)).toBe(false);
  });

  it("rejects duplicate members and revokes pending invitations", async () => {
    const owner = await newOwner("dup");
    expect((await createInvitation(owner, owner.email, "MEMBER")).success).toBe(false);
    const inv = await createInvitation(owner, `later_${Date.now()}@example.com`, "MEMBER");
    if (!inv.success) throw new Error(inv.error);
    expect(await revokeInvitation(owner.workspaceId, inv.invitation.id)).toBe(true);
    expect(await previewInvitation(inv.token)).toBeNull();
  });
});
