import React from "react";
import { WorkflowCanvas } from "@/components/canvas/workflow-canvas";
import { getWorkflowById } from "@/lib/services/workflow-service";
import { getCurrentSession } from "@/lib/services/auth-service";

interface WorkflowPageProps {
  params: Promise<{
    locale: string;
    id: string;
  }>;
}

export default async function WorkflowPage({ params }: WorkflowPageProps) {
  const { id } = await params;
  const session = await getCurrentSession();
  const workflow = await getWorkflowById(id);

  return (
    <main className="h-screen w-screen overflow-hidden">
      <WorkflowCanvas
        workflowId={id}
        initialName={
          workflow?.name || "Enterprise Customer Ingestion & Enrichment Pipeline"
        }
        initialStatus={workflow?.status || "DRAFT"}
        initialNodes={workflow?.nodes}
        initialEdges={workflow?.edges}
        session={session}
      />
    </main>
  );
}
