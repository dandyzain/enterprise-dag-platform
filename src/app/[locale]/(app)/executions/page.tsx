import React from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/patterns/page-container";
import { getExecutionsCached, getWorkflowsCached } from "@/lib/ui/server-data";
import { ExecutionsClient } from "./executions-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("runs");
  return { title: t("metaTitle") };
}

export default async function ExecutionsPage() {
  const [executions, workflows] = await Promise.all([
    getExecutionsCached(),
    getWorkflowsCached(),
  ]);

  const workflowNames: Record<string, string> = Object.fromEntries(workflows.map((w) => [w.id, w.name]));

  return (
    <PageContainer>
      <ExecutionsClient
        initialExecutions={executions}
        workflowNames={workflowNames}
      />
    </PageContainer>
  );
}
