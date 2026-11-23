import React from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WorkflowCanvas } from "@/components/canvas/workflow-canvas";
import { getWorkflowById } from "@/lib/services/workflow-service";
import { getCurrentSession } from "@/lib/services/auth-service";
import { WORKFLOW_TEMPLATES } from "@/lib/dag/templates";
import type { DAGEdge, DAGNode } from "@/lib/dag/types";

interface WorkflowPageProps {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ template?: string; replay?: string }>;
}

export async function generateMetadata({ params }: WorkflowPageProps): Promise<Metadata> {
  const { id } = await params;
  const workflow = await getWorkflowById(id);
  const t = await getTranslations("editor");
  return { title: workflow?.name ?? t("untitled") };
}

export default async function WorkflowPage({ params, searchParams }: WorkflowPageProps) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const session = await getCurrentSession();
  const workflow = await getWorkflowById(id);
  const t = await getTranslations("editor");

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
        initialNodes = template.nodes;
        initialEdges = template.edges;
        isNew = true;
      } else {
        // Legacy behaviour for unknown ids: canvas falls back to its default demo graph.
        initialName = "Enterprise Customer Ingestion & Enrichment Pipeline";
      }
    }
  }

  return (
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
  );
}
