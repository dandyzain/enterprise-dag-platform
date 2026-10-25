import { NextRequest, NextResponse } from "next/server";
import { listWorkflowExecutions } from "@/lib/services/execution-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const executions = await listWorkflowExecutions(id);

  return NextResponse.json({
    workflowId: id,
    count: executions.length,
    executions,
  });
}
