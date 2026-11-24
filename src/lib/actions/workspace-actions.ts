"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { guarded } from "@/lib/auth/guards";
import { isMemberRole, type MemberRole } from "@/lib/auth/rbac";
import {
  createInvitation,
  revokeInvitation,
  updateMemberRole,
  removeMember,
  type InvitationView,
} from "@/lib/services/workspace-service";
import {
  changePassword,
  updateProfileName,
  revokeAllSessions,
  getAuthCookieName,
  signSessionToken,
  sessionCookieOptions,
} from "@/lib/services/auth-service";
import { recordAudit } from "@/lib/services/audit-service";
import { getAppUrl } from "@/lib/config/env";

export async function inviteMemberAction(
  email: string,
  role: MemberRole,
  locale = "en"
): Promise<{ success: boolean; inviteUrl?: string; invitation?: InvitationView; error?: string }> {
  return guarded("member:manage", async (session) => {
    if (!isMemberRole(role)) return { success: false, error: "Invalid role." };
    const res = await createInvitation(session, email, role);
    if (!res.success) return res;
    await recordAudit(session, session.workspaceId, "member.invited", { type: "invitation", id: res.invitation.id }, {
      email: res.invitation.email,
      role,
    });
    const safeLocale = locale === "id" ? "id" : "en";
    revalidatePath("/", "layout");
    return {
      success: true,
      invitation: res.invitation,
      inviteUrl: `${getAppUrl()}/${safeLocale}/invite/${res.token}`,
    };
  });
}

export async function revokeInvitationAction(invitationId: string): Promise<{ success: boolean; error?: string }> {
  return guarded("member:manage", async (session) => {
    const ok = await revokeInvitation(session.workspaceId, invitationId);
    if (!ok) return { success: false, error: "Invitation not found." };
    await recordAudit(session, session.workspaceId, "member.invitation_revoked", { type: "invitation", id: invitationId });
    revalidatePath("/", "layout");
    return { success: true };
  });
}

export async function updateMemberRoleAction(userId: string, role: MemberRole): Promise<{ success: boolean; error?: string }> {
  return guarded("member:manage", async (session) => {
    if (!isMemberRole(role)) return { success: false, error: "Invalid role." };
    const res = await updateMemberRole(session, userId, role);
    if (!res.success) return { success: false, error: res.error ?? "Update failed." };
    await recordAudit(session, session.workspaceId, "member.role_changed", { type: "user", id: userId }, { role });
    revalidatePath("/", "layout");
    return { success: true };
  });
}

export async function removeMemberAction(userId: string): Promise<{ success: boolean; error?: string }> {
  return guarded("member:manage", async (session) => {
    const res = await removeMember(session, userId);
    if (!res.success) return { success: false, error: res.error ?? "Remove failed." };
    await recordAudit(session, session.workspaceId, "member.removed", { type: "user", id: userId });
    revalidatePath("/", "layout");
    return { success: true };
  });
}

export async function updateProfileAction(name: string): Promise<{ success: boolean; error?: string }> {
  return guarded(null, async (session) => {
    const res = await updateProfileName(session.id, name);
    if (!res.success) return { success: false, error: res.error ?? "Update failed." };
    const cookieStore = await cookies();
    cookieStore.set(getAuthCookieName(), signSessionToken({ ...session, name: name.trim() }), sessionCookieOptions());
    revalidatePath("/", "layout");
    return { success: true };
  });
}

export async function changePasswordAction(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  return guarded(null, async (session) => {
    const res = await changePassword(session.id, currentPassword, newPassword);
    if (!res.success) return { success: false, error: res.error ?? "Password change failed." };
    await recordAudit(session, session.workspaceId, "auth.password_changed", { type: "user", id: session.id });
    // Older tokens were revoked; issue a fresh one for this browser (iat is now ≥ revocation time).
    await new Promise((r) => setTimeout(r, 1100));
    const cookieStore = await cookies();
    cookieStore.set(getAuthCookieName(), signSessionToken(session), sessionCookieOptions());
    return { success: true };
  });
}

export async function signOutEverywhereAction(): Promise<{ success: boolean; error?: string }> {
  return guarded(null, async (session) => {
    await revokeAllSessions(session.id);
    await recordAudit(session, session.workspaceId, "auth.sessions_revoked", { type: "user", id: session.id });
    const cookieStore = await cookies();
    cookieStore.delete(getAuthCookieName());
    return { success: true };
  });
}
