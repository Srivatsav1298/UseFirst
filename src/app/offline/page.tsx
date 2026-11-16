import Link from "next/link";

export const metadata = { title: "Offline — USE FIRST" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-warmwhite px-6">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-forest-700">USE FIRST</p>
        <h1 className="mt-3 text-2xl font-bold">You are offline</h1>
        <p className="mt-2 text-stone-600">
          Your saved pages are still available. Reconnect to sync your household inventory.
        </p>
        <p className="mt-2 text-sm text-stone-500">Du er frakoblet. Gå tilbake til nettverket for å synkronisere.</p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-xl bg-forest-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-800"
        >
          Try again
        </Link>
      </div>
    </main>
  );
}
