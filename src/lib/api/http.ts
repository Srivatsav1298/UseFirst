import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth/session";
import { PermissionError } from "@/lib/permissions";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(status: number, message: string, code?: string, details?: unknown) {
  return NextResponse.json({ error: message, code, details }, { status });
}

export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.status, error.message, error.code, error.details);
    }
    if (error instanceof AuthError) {
      return fail(401, error.message, "unauthenticated");
    }
    if (error instanceof PermissionError) {
      return fail(403, error.message, "forbidden");
    }
    if (error instanceof ZodError) {
      return fail(422, "Invalid input", "validation_error", error.flatten());
    }
    console.error("Unhandled API error", error instanceof Error ? error.message : "unknown");
    return fail(500, "Something went wrong. Please try again.", "internal_error");
  }
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("host");
  try {
    const originUrl = new URL(origin);
    if (!host || originUrl.host !== host) {
      throw new ApiError(403, "Cross-origin request rejected", "csrf");
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(403, "Invalid origin", "csrf");
  }
}

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    throw new ApiError(429, "Too many attempts. Please wait and try again.", "rate_limited");
  }
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
  }
}

export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  return `${scope}:${ip}`;
}
