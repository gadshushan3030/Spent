import { NextResponse } from "next/server";
import { getSavingsProjection } from "@/server/db/queries/projection";
import { getWorkspaceIdFromRequest } from "@/server/lib/workspace-context";

export async function GET(request: Request) {
  const workspaceId = getWorkspaceIdFromRequest(request);
  return NextResponse.json(getSavingsProjection(workspaceId));
}
