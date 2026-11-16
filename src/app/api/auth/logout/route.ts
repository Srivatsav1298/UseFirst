import { destroyCurrentSession } from "@/lib/auth/session";
import { assertSameOrigin, handle, ok } from "@/lib/api/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    await destroyCurrentSession();
    return ok({ success: true });
  });
}
