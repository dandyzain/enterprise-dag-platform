"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Plus,
  Trash2,
  Copy,
  Check,
  Shield,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SafeCredentialRecord } from "@/lib/services/credential-service";
import {
  createCredentialAction,
  deleteCredentialAction,
} from "@/lib/actions/credential-actions";
import { toast } from "sonner";

interface CredentialsVaultClientProps {
  initialCredentials: SafeCredentialRecord[];
}

export function CredentialsVaultClient({
  initialCredentials,
}: CredentialsVaultClientProps) {
  const [credentials, setCredentials] = useState<SafeCredentialRecord[]>(initialCredentials);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [type, setType] = useState("api_key");
  const [value, setValue] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  function copyReference(credName: string) {
    const expr = `{{credentials.${credName}}}`;
    navigator.clipboard.writeText(expr);
    setCopiedKey(credName);
    toast.success(`Copied variable: ${expr}`);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !value.trim()) {
      toast.error("Please fill in both name and secret value.");
      return;
    }

    setIsCreating(true);
    try {
      const res = await createCredentialAction({
        name,
        type,
        value,
      });

      if (res.success && res.credential) {
        setCredentials((prev) => [res.credential!, ...prev]);
        toast.success(`Credential '${res.credential.name}' encrypted and stored in vault.`);
        setName("");
        setValue("");
        setIsModalOpen(false);
      } else {
        toast.error(res.error || "Failed to save credential.");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(id: string, credName: string) {
    const res = await deleteCredentialAction(id);
    if (res.success) {
      setCredentials((prev) => prev.filter((c) => c.id !== id));
      toast.info(`Credential '${credName}' removed from vault.`);
    } else {
      toast.error("Failed to delete credential.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 animate-fade-in-up animate-shimmer shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-400">
              <Shield className="h-4 w-4 animate-bounce-subtle" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-100">
              Hardware-Accelerated Vault
            </h2>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed max-w-xl">
            Tokens are encrypted using native Node.js AES-256-GCM cipher with unique 96-bit
            initialization vectors per credential. Decryption occurs strictly at worker runtime
            inside isolated execution batches.
          </p>
        </div>

        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold gap-1.5 shrink-0 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md shadow-emerald-950/40"
        >
          <Plus className="h-4 w-4" />
          <span>New Credential</span>
        </Button>
      </div>

      {/* Credentials Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden shadow-sm animate-fade-in-up delay-150">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
            <span>Stored Secrets</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 font-mono">
              {credentials.length}
            </span>
          </div>
          <div className="text-[11px] text-zinc-500">
            Click variable reference to copy expression
          </div>
        </div>

        {credentials.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Lock className="h-8 w-8 text-zinc-600 mx-auto animate-pulse" />
            <p className="text-xs text-zinc-400">
              No credentials found in vault. Add an API Key or Bearer Token to get started.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {credentials.map((cred) => (
              <div
                key={cred.id}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-zinc-850/50 hover:pl-5 transition-all duration-200 group"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-semibold font-mono text-zinc-100 group-hover:text-emerald-400 transition-colors">
                      {cred.name}
                    </span>
                    <Badge variant="action">{cred.type}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-400">
                    <span className="font-mono text-zinc-500 text-[11px]">
                      {cred.maskedValue}
                    </span>
                    <span>•</span>
                    <span className="text-[11px] text-zinc-500">
                      Created {new Date(cred.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 sm:gap-3">
                  <button
                    onClick={() => copyReference(cred.name)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-850 hover:border-violet-500/30 text-xs font-mono text-violet-400 hover:text-violet-300 transition-all hover:scale-[1.02] active:scale-[0.98] max-w-full"
                    title="Click to copy interpolation syntax"
                  >
                    <span className="truncate max-w-[200px] xs:max-w-xs">{`{{credentials.${cred.name}}}`}</span>
                    {copiedKey === cred.name ? (
                      <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                    ) : (
                      <Copy className="h-3 w-3 text-zinc-500 shrink-0" />
                    )}
                  </button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(cred.id, cred.name)}
                    className="h-8 w-8 text-zinc-500 hover:text-rose-400 hover:bg-rose-950/20 shrink-0"
                    title="Delete credential"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-5 animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <KeyRound className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-100">
                  Add Encrypted Secret
                </h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsModalOpen(false)}
                className="h-7 w-7 text-zinc-400 hover:text-zinc-100"
              >
                ✕
              </Button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">
                  Credential Name
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. STRIPE_API_KEY"
                  className="font-mono text-xs"
                  required
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  Identifier referenced as {"{{credentials.NAME}}"}
                </span>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">
                  Secret Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full h-8 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="api_key">API Key</option>
                  <option value="bearer_token">Bearer Token</option>
                  <option value="oauth_secret">OAuth Secret</option>
                  <option value="webhook_secret">Webhook Secret</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">
                  Plaintext Value
                </label>
                <div className="relative">
                  <Input
                    type={showSecret ? "text" : "password"}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Enter secret token to encrypt"
                    className="pr-10 font-mono text-xs"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                  >
                    {showSecret ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isCreating}
                  className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold"
                >
                  {isCreating ? "Encrypting..." : "Save to Vault"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
