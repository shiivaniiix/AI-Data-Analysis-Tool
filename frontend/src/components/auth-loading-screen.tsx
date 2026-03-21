"use client";

type AuthLoadingScreenProps = {
  message?: string;
};

/** Full-screen loading state while client auth is resolved (matches dashboard Suspense fallback). */
export function AuthLoadingScreen({ message = "Loading…" }: AuthLoadingScreenProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-linear-to-br from-zinc-950 via-saas-primary/10 to-zinc-950 px-6 py-10 text-zinc-200">
      <p className="text-sm text-saas-accent/80">{message}</p>
    </main>
  );
}
