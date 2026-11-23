"use client";

import React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link2, Mail, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/misc";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/patterns/confirm-dialog";
import { CopyButton } from "@/components/patterns/copy-button";
import { RelativeTime } from "@/components/patterns/relative-time";
import { canAssignRole, hasPermission, MEMBER_ROLES, type MemberRole } from "@/lib/auth/rbac";
import {
  inviteMemberAction,
  removeMemberAction,
  revokeInvitationAction,
  updateMemberRoleAction,
} from "@/lib/actions/workspace-actions";
import type { SessionUser } from "@/lib/services/auth-service";
import { DEMO_PERSONAS, useAccountActions, type DemoEmail } from "@/components/shell/use-account-actions";
import { cn, getInitials, splitNameTitle } from "@/lib/utils";

export interface MemberItem {
  userId: string;
  email: string;
  name: string;
  role: MemberRole;
  joinedAt: string;
  isDemo: boolean;
}

export interface InvitationItem {
  id: string;
  email: string;
  role: MemberRole;
  expiresAt: string;
  createdAt: string;
}

export function TeamPanel({
  session,
  members,
  invitations,
  demoMode,
}: {
  session: SessionUser;
  members: MemberItem[];
  invitations: InvitationItem[];
  demoMode: boolean;
}) {
  const t = useTranslations("settingsPage.team");
  const tAccount = useTranslations("account");
  const locale = useLocale();
  const router = useRouter();
  const { isPending, switchRole } = useAccountActions();
  const canManage = hasPermission(session.role, "member:manage");
  const isDemoPersona = DEMO_PERSONAS.some((p) => p.email === session.email);

  const assignable = MEMBER_ROLES.filter((r) => canAssignRole(session.role, r));
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<MemberRole>(assignable.includes("MEMBER") ? "MEMBER" : assignable[0] ?? "VIEWER");
  const [inviting, setInviting] = React.useState(false);
  const [lastInvite, setLastInvite] = React.useState<{ email: string; url: string } | null>(null);
  const [pendingRemove, setPendingRemove] = React.useState<MemberItem | null>(null);
  const [busyUser, setBusyUser] = React.useState<string | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    try {
      const res = await inviteMemberAction(email.trim(), role, locale);
      if (!res.success || !res.inviteUrl) {
        toast.error(res.error || t("failed"));
        return;
      }
      setLastInvite({ email: email.trim(), url: res.inviteUrl });
      setEmail("");
      toast.success(t("invited", { email: email.trim() }));
      router.refresh();
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(member: MemberItem, next: MemberRole) {
    setBusyUser(member.userId);
    try {
      const res = await updateMemberRoleAction(member.userId, next);
      if (!res.success) toast.error(res.error || t("failed"));
      else {
        toast.success(t("roleChanged", { name: member.name, role: tAccount(`roles.${next}`) }));
        router.refresh();
      }
    } finally {
      setBusyUser(null);
    }
  }

  async function handleRemove() {
    if (!pendingRemove) return;
    const res = await removeMemberAction(pendingRemove.userId);
    if (!res.success) {
      toast.error(res.error || t("failed"));
      return;
    }
    toast.success(t("removed", { name: pendingRemove.name }));
    setPendingRemove(null);
    router.refresh();
  }

  async function handleRevoke(inv: InvitationItem) {
    const res = await revokeInvitationAction(inv.id);
    if (!res.success) toast.error(res.error || t("failed"));
    else {
      toast.success(t("revoked", { email: inv.email }));
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <Card className="p-5">
          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
                <UserPlus className="size-4 text-fg-subtle" aria-hidden /> {t("inviteTitle")}
              </h3>
              <p className="mt-1 text-[13px] text-fg-muted">{t("inviteHint")}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_auto] sm:items-end">
              <Field id="invite-email" label={t("email")}>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  autoComplete="off"
                  required
                />
              </Field>
              <Field id="invite-role" label={t("role")}>
                <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assignable.map((r) => (
                      <SelectItem key={r} value={r}>
                        {tAccount(`roles.${r}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Button type="submit" loading={inviting}>
                {!inviting && <Mail aria-hidden />} {t("sendInvite")}
              </Button>
            </div>
            {lastInvite && (
              <div role="status" className="flex flex-col gap-2 rounded-xl border border-accent/30 bg-accent/5 p-3 sm:flex-row sm:items-center">
                <Link2 className="hidden size-4 shrink-0 text-accent sm:block" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-fg">{t("linkReady", { email: lastInvite.email })}</p>
                  <p className="truncate font-mono text-xs text-fg-muted">{lastInvite.url}</p>
                </div>
                <CopyButton value={lastInvite.url} label={t("copyLink")} showLabel variant="secondary" size="sm" />
              </div>
            )}
          </form>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>{t("membersTitle", { count: members.length })}</CardTitle>
            <CardDescription>{t("membersHint")}</CardDescription>
          </div>
        </CardHeader>
        <ul className="divide-y divide-line">
          {members.map((member) => {
            const isCurrent = session.id === member.userId || session.email === member.email;
            const { name, title } = splitNameTitle(member.name);
            const manageable = canManage && !isCurrent && !member.isDemo && canAssignRole(session.role, member.role);
            return (
              <li
                key={member.userId}
                className={cn("flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center", isCurrent && "bg-surface-2/50")}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-xs font-semibold text-fg">
                    {getInitials(member.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
                      <span className="truncate">{name}</span>
                      {isCurrent && <Badge variant="accent">{t("you")}</Badge>}
                      {member.isDemo && <Badge variant="outline">{t("demo")}</Badge>}
                    </p>
                    <p className="truncate text-xs text-fg-subtle">
                      {title ? `${title} · ` : ""}
                      {member.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-12 sm:pl-0">
                  {manageable ? (
                    <Select
                      value={member.role}
                      onValueChange={(v) => handleRoleChange(member, v as MemberRole)}
                      disabled={busyUser === member.userId}
                    >
                      <SelectTrigger className="h-8 w-32 text-[13px]" aria-label={t("changeRole", { name: member.name })}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {assignable.map((r) => (
                          <SelectItem key={r} value={r}>
                            {tAccount(`roles.${r}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="neutral">{tAccount(`roles.${member.role}`)}</Badge>
                  )}
                  {manageable && (
                    <Button
                      variant="danger-ghost"
                      size="icon-sm"
                      aria-label={t("remove", { name: member.name })}
                      onClick={() => setPendingRemove(member)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  )}
                  {demoMode && isDemoPersona && member.isDemo && !isCurrent && (
                    <Button variant="secondary" size="xs" disabled={isPending} onClick={() => switchRole(member.email as DemoEmail)}>
                      {t("assumeRole")}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {canManage && invitations.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <CardTitle>{t("pendingTitle", { count: invitations.length })}</CardTitle>
              <CardDescription>{t("pendingHint")}</CardDescription>
            </div>
          </CardHeader>
          <ul className="divide-y divide-line">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-fg">{inv.email}</p>
                  <p className="text-xs text-fg-subtle">
                    {t.rich("expires", { time: () => <RelativeTime date={inv.expiresAt} tooltip={false} /> })}
                  </p>
                </div>
                <Badge variant="neutral">{tAccount(`roles.${inv.role}`)}</Badge>
                <Button variant="ghost" size="xs" onClick={() => handleRevoke(inv)}>
                  <X aria-hidden /> {t("revoke")}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ConfirmDialog
        open={pendingRemove !== null}
        onOpenChange={(o) => !o && setPendingRemove(null)}
        tone="danger"
        title={t("removeTitle", { name: pendingRemove?.name ?? "" })}
        description={t("removeBody")}
        confirmLabel={t("removeConfirm")}
        onConfirm={handleRemove}
      />
    </div>
  );
}
