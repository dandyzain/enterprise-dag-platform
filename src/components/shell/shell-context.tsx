"use client";

import * as React from "react";

interface ShellContextValue {
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  newWorkflowOpen: boolean;
  setNewWorkflowOpen: (open: boolean) => void;
}

const ShellContext = React.createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [newWorkflowOpen, setNewWorkflowOpen] = React.useState(false);

  const value = React.useMemo(
    () => ({ commandOpen, setCommandOpen, newWorkflowOpen, setNewWorkflowOpen }),
    [commandOpen, newWorkflowOpen]
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

/** Access shell-level overlays. Safe to call outside the shell (no-ops). */
export function useShell(): ShellContextValue {
  return (
    React.useContext(ShellContext) ?? {
      commandOpen: false,
      setCommandOpen: () => {},
      newWorkflowOpen: false,
      setNewWorkflowOpen: () => {},
    }
  );
}
