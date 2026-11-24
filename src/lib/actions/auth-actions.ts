"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  authenticateUser,
  registerUser,
  signSessionToken,
  getAuthCookieName,
  sessionCookieOptions,
  getCurrentSession,
  switchWorkspace,
  DEMO_USERS,
  type SessionUser,
} from "@/lib/services/auth-service";
import { isDemoMode } from "@/lib/config/env";
import { isDemoEmail, type DemoEmail } from "@/lib/auth/demo";
import { checkRateLimit } from "@/lib/security/rate-limiter";
import { recordAudit } from "@/lib/services/audit-service";
import { acceptInvitation } from "@/lib/services/workspace-service";

async function setSessionCookie(session: SessionUser) {
  const cookieStore = await cookies();
  cookieStore.set(getAuthCookieName(), signSessionToken(session), sessionCookieOptions());
}

async function clientKey(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "local").trim();
}

/** Attempt limiting: 10 tries per minute per IP and per account. */
async function throttle(scope: string, email: string): Promise<string | null> {
  const ip = await clientKey();
  const byIp = checkRateLimit(`${scope}:ip:${ip}`, { maxRequests: 10, windowMs: 60_000 });
  const byAccount = checkRateLimit(`${scope}:acct:${email}`, { maxRequests: 10, windowMs: 60_000 });
  if (!byIp.allowed || !byAccount.allowed) return "Too many attempts. Please wait a minute and try again.";
  return null;
}

async function maybeAcceptInvite(session: SessionUser, inviteToken: string): Promise<SessionUser> {
  if (!inviteToken) return session;
  const accepted = await acceptInvitation(session, inviteToken);
  if (!accepted.success) return session;
  await recordAudit(session, accepted.workspaceId, "member.joined", { type: "user", id: session.id }, { role: accepted.role });
  return (await switchWorkspace(session, accepted.workspaceId)) ?? session;
}

export async function loginAction(
  formData: FormData
): Promise<{ success: boolean; session?: SessionUser; error?: string }> {
  const email = String(formData.get("email") || "").toLowerCase().trim();
  const password = String(formData.get("password") || "");
  const inviteToken = String(formData.get("invite") || "");

  if (!email || !password) {
    return { success: false, error: "Please enter both email and password." };
  }
  const throttled = await throttle("login", email);
  if (throttled) return { success: false, error: throttled };

  const result = await authenticateUser(email, password);
  if (!result.success || !result.session) {
    return { success: false, error: result.error || "Authentication failed." };
  }

  const session = await maybeAcceptInvite(result.session, inviteToken);
  await setSessionCookie(session);
  await recordAudit(session, session.workspaceId, "auth.login", { type: "user", id: session.id });
  revalidatePath("/", "layout");
  return { success: true, session };
}

export async function registerAction(
  formData: FormData
): Promise<{ success: boolean; session?: SessionUser; error?: string }> {
  const email = String(formData.get("email") || "").toLowerCase().trim();
  const password = String(formData.get("password") || "");
  const name = String(formData.get("name") || "");
  const workspaceName = String(formData.get("workspaceName") || "Enterprise Team");
  const inviteToken = String(formData.get("invite") || "");

  if (!email || !password || !name) {
    return { success: false, error: "Please fill in all required fields." };
  }
  const throttled = await throttle("register", email);
  if (throttled) return { success: false, error: throttled };

  const result = await registerUser(email, password, name, workspaceName);
  if (!result.success || !result.session) {
    return { success: false, error: result.error || "Registration failed." };
  }

  const session = await maybeAcceptInvite(result.session, inviteToken);
  await setSessionCookie(session);
  revalidatePath("/", "layout");
  return { success: true, session };
}

/** Demo-only: hop between the three demo personas (same demo workspace). */
export async function switchDemoRoleAction(
  demoEmail: DemoEmail
): Promise<{ success: boolean; session?: SessionUser; error?: string }> {
  if (!isDemoMode() || !isDemoEmail(demoEmail)) {
    return { success: false, error: "Demo mode is disabled." };
  }
  const demo = DEMO_USERS[demoEmail];
  await setSessionCookie(demo.session);
  revalidatePath("/", "layout");
  return { success: true, session: demo.session };
}

export async function switchWorkspaceAction(workspaceId: string): Promise<{ success: boolean; error?: string }> {
  const session = await getCurrentSession();
  if (!session) return { success: false, error: "Please sign in to continue." };
  const next = await switchWorkspace(session, workspaceId);
  if (!next) return { success: false, error: "You are not a member of that workspace." };
  await setSessionCookie(next);
  revalidatePath("/", "layout");
  return { success: true };
}

export async function acceptInvitationAction(token: string): Promise<{ success: boolean; error?: string }> {
  const session = await getCurrentSession();
  if (!session) return { success: false, error: "Please sign in to continue." };
  const accepted = await acceptInvitation(session, token);
  if (!accepted.success) return { success: false, error: accepted.error };
  await recordAudit(session, accepted.workspaceId, "member.joined", { type: "user", id: session.id }, { role: accepted.role });
  const next = await switchWorkspace(session, accepted.workspaceId);
  if (next) await setSessionCookie(next);
  revalidatePath("/", "layout");
  return { success: true };
}

export async function logoutAction(): Promise<{ success: boolean }> {
  const session = await getCurrentSession();
  const cookieStore = await cookies();
  cookieStore.delete(getAuthCookieName());
  if (session) await recordAudit(session, session.workspaceId, "auth.logout", { type: "user", id: session.id });
  revalidatePath("/", "layout");
  return { success: true };
}
