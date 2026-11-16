import { Suspense } from "react";
import { ScanClient } from "@/features/scanner/scan-client";

export const dynamic = "force-dynamic";

export default function ScanPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-5" aria-busy="true">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-stone-100" />
          <div className="h-12 animate-pulse rounded-xl bg-stone-100" />
          <div className="h-72 animate-pulse rounded-2xl bg-stone-100" />
        </div>
      }
    >
      <ScanClient />
    </Suspense>
  );
}
