import { db } from "@/lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const database = await db();
    await database.execute("SELECT 1");
    return Response.json({ status: "ok", database: "ready" });
  } catch {
    return Response.json({ status: "error", database: "unavailable" }, { status: 503 });
  }
}
