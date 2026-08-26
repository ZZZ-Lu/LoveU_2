import {clearDebugRuns, listDebugRuns} from "../debug-store";

export async function GET() {
  return Response.json({runs: listDebugRuns()});
}

export async function DELETE() {
  clearDebugRuns();
  return Response.json({ok: true});
}
