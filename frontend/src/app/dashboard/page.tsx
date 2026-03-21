"use client";

import { Suspense, useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthLoadingScreen } from "@/components/auth-loading-screen";
import { DashboardAuthActions } from "@/components/dashboard-auth-actions";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/api";
import { buttonMotion, slideInLeft } from "@/lib/motion-presets";
import { UserMessage, userFacingError } from "@/lib/user-messages";
import { getNewChatId, removeNewChatId } from "@/utils/storage";

type ChatSession = {
  id: string;
  user_id: string;
  file_name: string | null;
  file_url: string | null;
  created_at: string;
  can_edit: boolean;
  is_owner: boolean;
};

function DashboardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, loading: authLoading, isLoggedIn } = useAuth();
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialChatId = searchParams.get("chatId");

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn || !token) {
      router.push("/login");
      return;
    }
    if (initialChatId) {
      router.replace(`/chat/${encodeURIComponent(initialChatId)}`);
      return;
    }
    void loadChats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isLoggedIn, token, initialChatId, router]);

  const loadChats = async () => {
    if (!token) return;
    setError(null);
    setLoadingChats(true);
    try {
      const list = await apiRequest<ChatSession[]>("/chats", { token });
      setChats(list);

      const newChatIdFromLogin = getNewChatId();
      if (newChatIdFromLogin && list.some((c) => c.id === newChatIdFromLogin)) {
        removeNewChatId();
        router.replace(`/chat/${newChatIdFromLogin}`);
        return;
      }
    } catch (err) {
      setError(userFacingError(err, UserMessage.loadChats));
    } finally {
      setLoadingChats(false);
    }
  };

  const createNewChat = async () => {
    if (!token) return;
    setError(null);
    setLoadingChats(true);
    try {
      const created = await apiRequest<ChatSession>("/chats", { method: "POST", token });
      router.push(`/chat/${created.id}`);
    } catch (err) {
      setError(userFacingError(err, UserMessage.newChat));
    } finally {
      setLoadingChats(false);
    }
  };

  if (authLoading) {
    return <AuthLoadingScreen message="Loading dashboard…" />;
  }

  if (!token) {
    return <AuthLoadingScreen message="Redirecting…" />;
  }

  return (
    <main className="flex h-screen bg-linear-to-br from-zinc-950 via-saas-primary/12 to-zinc-950 text-zinc-100">
      <motion.aside
        {...slideInLeft}
        className="flex w-[320px] flex-col border-r border-white/6 bg-linear-to-b from-zinc-950 via-saas-primary/8 to-zinc-900/98 backdrop-blur-sm"
      >
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <Link
              href="/"
              className="text-sm font-semibold tracking-wide text-white transition hover:text-saas-accent"
            >
              DataChat AI
            </Link>
            <motion.button
              type="button"
              onClick={() => void createNewChat()}
              disabled={loadingChats}
              {...(!loadingChats ? buttonMotion : {})}
              className="rounded-xl bg-linear-to-br from-saas-primary to-saas-accent px-2 py-1 text-xs font-semibold text-white shadow-md shadow-saas-primary/25 transition-shadow duration-200 hover:shadow-lg hover:shadow-saas-primary/30 disabled:opacity-70"
            >
              New Chat
            </motion.button>
          </div>

          {error ? (
            <div className="mb-3 rounded-xl border border-rose-900/50 bg-rose-950/20 px-3 py-2 text-xs text-rose-200">
              {error}
            </div>
          ) : null}

          {loadingChats ? (
            <div className="rounded-xl border border-white/5 bg-zinc-950/30 px-3 py-6 text-center">
              <p className="text-xs text-zinc-500">Loading your chats…</p>
            </div>
          ) : chats.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-zinc-950/30 px-3 py-6 text-center">
              <p className="text-xs font-medium leading-relaxed text-zinc-300">
                No chats yet. Create one to start.
              </p>
            </div>
          ) : (
            <ul className="max-h-[calc(100vh-210px)] space-y-2 overflow-auto pr-1">
              {chats.map((c) => (
                <motion.li
                  key={c.id}
                  whileHover={{ scale: 1.015 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="cursor-pointer rounded-xl border border-zinc-800/80 bg-zinc-900/35 px-3 py-2 text-xs transition-colors duration-200 hover:border-saas-primary/25 hover:bg-zinc-900/60 hover:shadow-md"
                  onClick={() => router.push(`/chat/${c.id}`)}
                  title={c.file_name ?? "New chat"}
                >
                  <p className="truncate font-medium text-zinc-100">{c.file_name ?? "New chat"}</p>
                  <p className="mt-1 text-[11px] text-zinc-400">{(c.created_at ?? "").slice(0, 10)}</p>
                </motion.li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-auto p-4">
          <DashboardAuthActions />
        </div>
      </motion.aside>

      <section className="flex flex-1 items-center justify-center px-8">
        <div className="max-w-xl rounded-2xl border border-white/8 bg-linear-to-br from-zinc-900/90 to-saas-primary/10 p-10 text-center shadow-xl shadow-black/20">
          <h1 className="text-2xl font-semibold text-white">Your chats</h1>
          <p className="mt-3 text-sm text-zinc-400">
            Select a chat from the left or create a new one. Each chat has its own URL under
            <span className="text-zinc-300"> /chat/[chatId]</span>.
          </p>
        </div>
      </section>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<AuthLoadingScreen message="Loading dashboard…" />}>
      <DashboardPageContent />
    </Suspense>
  );
}
