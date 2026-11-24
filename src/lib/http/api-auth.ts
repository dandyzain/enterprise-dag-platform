import { NextResponse } from "next/server";
import { getCurrentSession, type SessionUser } from "@/lib/services/auth-service";
import { hasPermission, type Permission } from "@/lib/auth/rbac";

/** Route-handler guard: the session holding `permission`, or a 401/403 JSON response. */
export async function apiSession(permission: Permission): Promise<SessionUser | NextResponse> {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  if (!hasPermission(session.role, permission)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  return session;
}
