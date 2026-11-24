import { NextRequest, NextResponse } from "next/server";
import { listExecutions } from "@/lib/services/execution-service";
import { getWorkflowForWorkspace } from "@/lib/services/workflow-service";
import { apiSession } from "@/lib/http/api-auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await apiSession("execution:view");
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const workflow = await getWorkflowForWorkspace(id, session.workspaceId);
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
  }

  const limit = Number(request.nextUrl.searchParams.get("limit") || "50");
  const executions = await listExecutions({ workspaceId: session.workspaceId, workflowId: id, limit });

  return NextResponse.json(
    { workflowId: id, count: executions.length, executions },
    { headers: { "Cache-Control": "no-store" } }
  );
}
