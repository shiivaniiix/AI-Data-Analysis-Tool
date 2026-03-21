"use client";

import { motion } from "framer-motion";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { buttonMotion, fadeInUp } from "@/lib/motion-presets";
import { UserMessage, userFacingError } from "@/lib/user-messages";

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
        setError(UserMessage.missingShareToken);
        return;
      }

      const jwt = localStorage.getItem("datachat_token");
      if (!jwt) {
        setLoading(false);
        setError(UserMessage.needLoginForShare);
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
          throw new Error(data?.detail ?? UserMessage.acceptShare);
        }

        const data = (await resp.json()) as { chat_id: string; permission: string };
        router.push(`/dashboard?chatId=${encodeURIComponent(data.chat_id)}`);
      } catch (err) {
        setError(userFacingError(err, UserMessage.acceptShare));
      } finally {
        setLoading(false);
      }
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareToken]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-linear-to-br from-zinc-950 via-saas-primary/10 to-zinc-950 px-6 py-20 text-zinc-100">
      <motion.div
        {...fadeInUp}
        className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-linear-to-br from-zinc-900/92 via-zinc-900/75 to-saas-primary/12 p-8 shadow-2xl shadow-saas-primary/15 backdrop-blur-xl transition-all duration-300 hover:border-white/10"
      >
        <h1 className="bg-linear-to-r from-white via-saas-primary/80 to-saas-accent bg-clip-text text-2xl font-semibold tracking-tight text-transparent">
          Shared chat
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          {loading ? "Granting access…" : error ? "Could not access this chat." : "Redirecting…"}
        </p>
        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
        {!loading && !error ? (
          <motion.button
            type="button"
            onClick={() => router.push("/dashboard")}
            {...buttonMotion}
            className="mt-6 w-full rounded-xl bg-linear-to-br from-saas-primary to-saas-accent px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-saas-primary/25 transition-shadow duration-200 hover:shadow-xl hover:shadow-saas-primary/35"
          >
            Go to Dashboard
          </motion.button>
        ) : null}
      </motion.div>
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

