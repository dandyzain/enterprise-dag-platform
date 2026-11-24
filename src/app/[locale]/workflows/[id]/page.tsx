import React from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { WorkflowCanvas } from "@/components/canvas/workflow-canvas";
import { AccountProvider } from "@/components/shell/account-context";
import { getWorkflowById, getWorkflowForWorkspace } from "@/lib/services/workflow-service";
import { getSessionCached, getWorkspacesCached } from "@/lib/ui/server-data";
import { isDemoMode } from "@/lib/config/env";
import { WORKFLOW_TEMPLATES } from "@/lib/dag/templates";
import type { DAGEdge, DAGNode } from "@/lib/dag/types";

interface WorkflowPageProps {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ template?: string; replay?: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: WorkflowPageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await getSessionCached();
  const workflow = session ? await getWorkflowForWorkspace(id, session.workspaceId) : null;
  const t = await getTranslations("editor");
  return { title: workflow?.name ?? t("untitled") };
}

/** Templates ship with fixed webhook paths; give every new workflow its own endpoint. */
function withUniqueWebhookPath(nodes: DAGNode[], workflowId: string): DAGNode[] {
  return nodes.map((n) =>
    n.data?.type === "webhook" ? { ...n, data: { ...n.data, config: { ...n.data.config, path: `wh-${workflowId}` } } } : n
  );
}

export default async function WorkflowPage({ params, searchParams }: WorkflowPageProps) {
  const [{ id }, sp, session, locale] = await Promise.all([params, searchParams, getSessionCached(), getLocale()]);
  if (!session) redirect(`/${locale}/login?next=${encodeURIComponent(`/workflows/${id}`)}`);

  const t = await getTranslations("editor");
  const workflow = await getWorkflowForWorkspace(id, session.workspaceId);
  if (!workflow && (await getWorkflowById(id))) {
    // Exists, but in another workspace: don't reveal it.
    notFound();
  }

  let initialName = workflow?.name;
  let initialNodes: DAGNode[] | undefined = workflow?.nodes;
  let initialEdges: DAGEdge[] | undefined = workflow?.edges;
  let isNew = false;

  if (!workflow) {
    if (sp.template === "blank") {
      // "New workflow → Blank canvas" from the template gallery.
      initialName = t("untitled");
      initialNodes = [];
      initialEdges = [];
      isNew = true;
    } else {
      const template = WORKFLOW_TEMPLATES.find((tpl) => tpl.id === sp.template);
      if (template) {
        initialName = template.name;
        initialNodes = withUniqueWebhookPath(template.nodes, id);
        initialEdges = template.edges;
        isNew = true;
      } else {
        // Legacy behaviour for unknown ids: canvas falls back to its default demo graph.
        initialName = "Enterprise Customer Ingestion & Enrichment Pipeline";
        isNew = true;
      }
    }
  }

  const workspaces = await getWorkspacesCached();

  return (
    <AccountProvider value={{ demoMode: isDemoMode(), workspaces }}>
      <main className="h-dvh w-full overflow-hidden">
        <WorkflowCanvas
          workflowId={id}
          initialName={initialName ?? t("untitled")}
          initialStatus={workflow?.status || "DRAFT"}
          initialNodes={initialNodes}
          initialEdges={initialEdges}
          session={session}
          isNew={isNew}
          replayExecutionId={sp.replay ?? null}
        />
      </main>
    </AccountProvider>
  );
}
