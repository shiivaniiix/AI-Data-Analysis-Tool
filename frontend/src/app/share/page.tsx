"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function SharePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shareToken = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!shareToken) {
        setLoading(false);
        setError("Missing share token.");
        return;
      }

      const jwt = localStorage.getItem("datachat_token");
      if (!jwt) {
        setLoading(false);
        setError("Please log in to access the shared chat.");
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const apiBase =
          process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
          "http://localhost:8000/api";

        const resp = await fetch(`${apiBase}/chats/accept-share`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({ token: shareToken }),
        });

        if (!resp.ok) {
          const data = await resp.json().catch(() => null);
          throw new Error(data?.detail ?? "Unable to accept share link.");
        }

        const data = (await resp.json()) as { chat_id: string; permission: string };
        router.push(`/dashboard?chatId=${encodeURIComponent(data.chat_id)}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to accept share link.");
      } finally {
        setLoading(false);
      }
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareToken]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 py-20 text-zinc-100">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8 shadow-xl">
        <h1 className="text-2xl font-semibold tracking-tight">Shared chat</h1>
        <p className="mt-2 text-sm text-zinc-400">
          {loading ? "Granting access…" : error ? "Could not access this chat." : "Redirecting…"}
        </p>
        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
        {!loading && !error ? (
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="mt-6 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200"
          >
            Go to Dashboard
          </button>
        ) : null}
      </div>
    </main>
  );
}

export default function SharePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 py-20 text-zinc-100">
          <p className="text-sm text-zinc-400">Loading…</p>
        </main>
      }
    >
      <SharePageContent />
    </Suspense>
  );
}

