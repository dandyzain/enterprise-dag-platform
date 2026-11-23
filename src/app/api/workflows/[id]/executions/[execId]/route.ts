import { NextRequest, NextResponse } from "next/server";
import { getExecutionForWorkspace } from "@/lib/services/execution-service";
import { apiSession } from "@/lib/http/api-auth";

interface RouteParams {
  params: Promise<{ id: string; execId: string }>;
}

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await apiSession("execution:view");
  if (session instanceof NextResponse) return session;

  const { id, execId } = await params;
  const execution = await getExecutionForWorkspace(execId, session.workspaceId);
  if (!execution || execution.workflowId !== id) {
    return NextResponse.json({ error: `Execution record '${execId}' not found.` }, { status: 404 });
  }

  return NextResponse.json({ execution }, { headers: { "Cache-Control": "no-store" } });
}
