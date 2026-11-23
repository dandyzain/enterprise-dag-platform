/** Shared between the server page and the client component (plain module, not "use client"). */
export const SETTINGS_TABS = ["overview", "team", "account", "security", "permissions", "audit"] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];
