"use client";

import * as React from "react";
import type { WorkspaceSummary } from "@/lib/services/auth-service";

export interface AccountContextValue {
  /** Demo accounts + role switcher are available. */
  demoMode: boolean;
  /** Workspaces the signed-in user belongs to (for the workspace switcher). */
  workspaces: WorkspaceSummary[];
}

const AccountContext = React.createContext<AccountContextValue>({ demoMode: false, workspaces: [] });

export function AccountProvider({ value, children }: { value: AccountContextValue; children: React.ReactNode }) {
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  return React.useContext(AccountContext);
}
