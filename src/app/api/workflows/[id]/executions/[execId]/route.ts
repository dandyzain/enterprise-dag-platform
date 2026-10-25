import { NextRequest, NextResponse } from "next/server";
import { getWorkflowExecution } from "@/lib/services/execution-service";

interface RouteParams {
  params: Promise<{ id: string; execId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { execId } = await params;
  const execution = await getWorkflowExecution(execId);

  if (!execution) {
    return NextResponse.json(
      { error: `Execution record '${execId}' not found.` },
      { status: 404 }
    );
  }

  return NextResponse.json({
    execution,
  });
}
