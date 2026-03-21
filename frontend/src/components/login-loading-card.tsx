"use client";

/** SSR-safe placeholder matching login card footprint (avoids layout shift). */
export function LoginLoadingCard() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-linear-to-br from-zinc-950 via-saas-primary/10 to-zinc-950 px-6 py-20">
      <div
        className="w-full max-w-md animate-pulse rounded-2xl border border-white/8 bg-linear-to-br from-zinc-900/92 via-zinc-900/75 to-saas-primary/12 p-8 shadow-2xl shadow-saas-primary/15 backdrop-blur-xl"
        aria-hidden
      >
        <div className="h-8 w-48 rounded-lg bg-zinc-800/90" />
        <div className="mt-3 h-4 w-full max-w-xs rounded bg-zinc-800/70" />
        <div className="mt-8 space-y-4">
          <div className="h-10 w-full rounded-xl bg-zinc-800/80" />
          <div className="h-10 w-full rounded-xl bg-zinc-800/80" />
          <div className="h-11 w-full rounded-xl bg-zinc-800/80" />
        </div>
      </div>
    </main>
  );
}
