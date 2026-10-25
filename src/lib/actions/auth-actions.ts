"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  authenticateUser,
  registerUser,
  signSessionToken,
  getAuthCookieName,
  DEMO_USERS,
  SessionUser,
} from "@/lib/services/auth-service";

export async function loginAction(
  formData: FormData
): Promise<{ success: boolean; session?: SessionUser; error?: string }> {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { success: false, error: "Please enter both email and password." };
  }

  const result = await authenticateUser(email, password);
  if (!result.success || !result.session) {
    return { success: false, error: result.error || "Authentication failed." };
  }

  const token = signSessionToken(result.session);
  const cookieStore = await cookies();
  cookieStore.set(getAuthCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  revalidatePath("/");
  return { success: true, session: result.session };
}

export async function registerAction(
  formData: FormData
): Promise<{ success: boolean; session?: SessionUser; error?: string }> {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const name = String(formData.get("name") || "");
  const workspaceName = String(formData.get("workspaceName") || "Enterprise Team");

  if (!email || !password || !name) {
    return { success: false, error: "Please fill in all required fields." };
  }

  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }

  const result = await registerUser(email, password, name, workspaceName);
  if (!result.success || !result.session) {
    return { success: false, error: result.error || "Registration failed." };
  }

  const token = signSessionToken(result.session);
  const cookieStore = await cookies();
  cookieStore.set(getAuthCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  revalidatePath("/");
  return { success: true, session: result.session };
}

export async function switchDemoRoleAction(
  demoEmail: "admin@enterprise.io" | "editor@enterprise.io" | "viewer@enterprise.io"
): Promise<{ success: boolean; session: SessionUser }> {
  const demo = DEMO_USERS[demoEmail];
  const token = signSessionToken(demo.session);
  const cookieStore = await cookies();
  cookieStore.set(getAuthCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  revalidatePath("/");
  return { success: true, session: demo.session };
}

export async function logoutAction(): Promise<{ success: boolean }> {
  const cookieStore = await cookies();
  cookieStore.set(getAuthCookieName(), "LOGGED_OUT", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  revalidatePath("/");
  return { success: true };
}
