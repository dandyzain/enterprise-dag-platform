import { getCurrentSession, type SessionUser } from "@/lib/services/auth-service";
import { hasPermission, type Permission } from "@/lib/auth/rbac";

export class AuthError extends Error {
  constructor(
    public readonly code: "UNAUTHENTICATED" | "FORBIDDEN",
    message?: string
  ) {
    super(message ?? (code === "UNAUTHENTICATED" ? "Please sign in to continue." : "You do not have permission to do that."));
    this.name = "AuthError";
  }

  get status(): 401 | 403 {
    return this.code === "UNAUTHENTICATED" ? 401 : 403;
  }
}

/** Server-side: the signed-in user, or throws AuthError(UNAUTHENTICATED). */
export async function requireSession(): Promise<SessionUser> {
  const session = await getCurrentSession();
  if (!session) throw new AuthError("UNAUTHENTICATED");
  return session;
}

/** Server-side: the signed-in user holding `permission` in their active workspace. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const session = await requireSession();
  if (!hasPermission(session.role, permission)) throw new AuthError("FORBIDDEN");
  return session;
}

export type ActionFailure = { success: false; error: string; code?: string; cycleNodes?: string[] };
export type ActionResult<T extends object = object> = ({ success: true } & T) | ActionFailure;

/**
 * Wraps a server action body: converts AuthError (and unexpected errors) into
 * the `{ success: false, error }` shape the UI already understands, so every
 * action is authenticated without try/catch boilerplate.
 */
export async function guarded<R extends { success: boolean }>(
  permission: Permission | null,
  body: (session: SessionUser) => Promise<R>
): Promise<R | ActionFailure> {
  try {
    const session = permission ? await requirePermission(permission) : await requireSession();
    return await body(session);
  } catch (err) {
    if (err instanceof AuthError) return { success: false, error: err.message, code: err.code };
    if (err instanceof QuotaError) return { success: false, error: err.message, code: "QUOTA_EXCEEDED" };
    throw err;
  }
}

export class QuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaError";
  }
}
