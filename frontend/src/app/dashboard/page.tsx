"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthLoadingScreen } from "@/components/auth-loading-screen";
import { DashboardAuthActions } from "@/components/dashboard-auth-actions";
import { ButtonSpinner } from "@/components/button-spinner";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, apiUpload } from "@/lib/api";
import { buttonMotion, fadeIn, fadeInUpDelayed, slideInLeft } from "@/lib/motion-presets";
import { UserMessage, userFacingError } from "@/lib/user-messages";
import { InsightsCharts } from "@/components/insights-charts";
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

type ChatMessage = {
  id: number;
  chat_id: string;
  user_id: string;
  role: string;
  content: string;
  created_at: string;
};

function DashboardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, loading: authLoading, isLoggedIn } = useAuth();

  const [chats, setChats] = useState<ChatSession[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const selectedChat = useMemo(
    () => chats.find((c) => c.id === selectedChatId) ?? null,
    [chats, selectedChatId],
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const initialChatId = searchParams.get("chatId");
  const [sharePermission, setSharePermission] = useState<"view" | "edit">("view");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [showShareLinkContainer, setShowShareLinkContainer] = useState(true);

  // UI-only rename support (no backend/persistence yet).
  const [titleOverrides, setTitleOverrides] = useState<Record<string, string>>({});
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const cancelRename = () => {
    setEditingChatId(null);
    setEditingTitle("");
  };

  const commitRename = (chatId: string) => {
    const trimmed = editingTitle.trim();
    if (!trimmed) {
      cancelRename();
      return;
    }
    setTitleOverrides((prev) => ({ ...prev, [chatId]: trimmed }));
    cancelRename();
  };

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn || !token) {
      router.push("/login");
      return;
    }
    void loadChats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isLoggedIn, token, router]);

  useEffect(() => {
    if (!selectedChatId || !token) return;
    void loadMessages(selectedChatId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChatId, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loadingMessages]);

  const loadChats = async () => {
    if (!token) return;
    const newChatIdFromLogin = getNewChatId();
    setError(null);
    setLoadingChats(true);
    try {
      const list = await apiRequest<ChatSession[]>("/chats", { token });
      setChats(list);

      const preferred =
        (initialChatId && list.some((c) => c.id === initialChatId)
          ? initialChatId
          : newChatIdFromLogin && list.some((c) => c.id === newChatIdFromLogin)
            ? newChatIdFromLogin
            : selectedChatId && list.some((c) => c.id === selectedChatId)
              ? selectedChatId
              : list[0]?.id ?? null) ?? null;
      setSelectedChatId(preferred);

      if (newChatIdFromLogin) {
        removeNewChatId();
      }
    } catch (err) {
      setError(userFacingError(err, UserMessage.loadChats));
    } finally {
      setLoadingChats(false);
    }
  };

  const loadMessages = async (chatId: string) => {
    if (!token) return;
    setError(null);
    setLoadingMessages(true);
    try {
      const list = await apiRequest<ChatMessage[]>(`/chats/${chatId}/messages`, { token });
      setMessages(list);
    } catch (err) {
      setError(userFacingError(err, UserMessage.loadMessages));
    } finally {
      setLoadingMessages(false);
    }
  };

  const createNewChat = async () => {
    if (!token) return;
    setError(null);
    setLoadingChats(true);
    try {
      const created = await apiRequest<ChatSession>("/chats", { method: "POST", token });
      const updated = [created, ...chats];
      setChats(updated);
      setSelectedChatId(created.id);
      setMessages([]);
    } catch (err) {
      setError(userFacingError(err, UserMessage.newChat));
    } finally {
      setLoadingChats(false);
    }
  };

  const deleteChat = async (chatId: string) => {
    if (!token) return;
    setError(null);
    try {
      await apiRequest<void>(`/chats/${chatId}`, { method: "DELETE", token });
      const remaining = chats.filter((c) => c.id !== chatId);
      setChats(remaining);
      if (selectedChatId === chatId) {
        setSelectedChatId(remaining[0]?.id ?? null);
        setMessages([]);
      }
    } catch (err) {
      setError(userFacingError(err, UserMessage.deleteChat));
    }
  };

  const handleUpload = async () => {
    if (!token || !selectedChatId) return;
    if (!uploadFile) {
      setError(UserMessage.pickFile);
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      await apiUpload<ChatSession>(`/chats/${selectedChatId}/upload`, { body: formData, token });

      setUploadFile(null);
      // Refresh chat list and messages.
      await loadChats();
      if (selectedChatId) {
        await loadMessages(selectedChatId);
      }
    } catch (err) {
      setError(userFacingError(err, UserMessage.upload));
    } finally {
      setUploading(false);
    }
  };

  const sendMessage = async () => {
    if (!token || !selectedChatId) return;
    if (selectedChat && !selectedChat.can_edit) return;
    const trimmed = draft.trim();
    if (!trimmed) return;

    const lower = trimmed.toLowerCase();
    const apiBase =
      process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
      "http://localhost:8000/api";

    setError(null);
    setSending(true);
    try {
      setDraft("");

      // Natural-language export commands (handled client-side).
      const wantsPdf =
        lower.includes("pdf") &&
        (lower.includes("export") || lower.includes("download") || lower.includes("generate") || lower.includes("report"));
      const wantsDocx =
        (lower.includes("doc") || lower.includes("docx")) &&
        (lower.includes("export") || lower.includes("generate") || lower.includes("download") || lower.includes("report"));
      const wantsCsv =
        lower.includes("csv") && (lower.includes("export") || lower.includes("download") || lower.includes("generate"));

      const isExportCommand = wantsPdf || wantsDocx || wantsCsv;
      if (isExportCommand) {
        const kind = wantsPdf ? "pdf" : wantsDocx ? "docx" : "csv";
        const resp = await fetch(
          `${apiBase}/chats/${selectedChatId}/export/${kind}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              filter_column: null,
              filter_values: null,
              limit_rows: 10000,
            }),
          },
        );
        if (!resp.ok) {
          const data = await resp.json().catch(() => null);
          throw new Error(data?.detail ?? UserMessage.export);
        }

        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download =
          kind === "pdf"
            ? `chat_${selectedChatId}_report.pdf`
            : kind === "docx"
              ? `chat_${selectedChatId}_report.docx`
              : `chat_${selectedChatId}_export.csv`;
        a.click();
        URL.revokeObjectURL(url);

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            chat_id: selectedChatId,
            user_id: "me",
            role: "assistant",
            content:
              kind === "pdf"
                ? "PDF report generated and downloaded."
                : kind === "docx"
                  ? "DOCX report generated and downloaded."
                  : "CSV export downloaded.",
            created_at: new Date().toISOString(),
          },
        ]);

        return;
      }

      await apiRequest<ChatMessage>(`/chats/${selectedChatId}/messages`, {
        method: "POST",
        token,
        body: { message: trimmed },
      });
      await loadMessages(selectedChatId);
    } catch (err) {
      setError(userFacingError(err, UserMessage.sendMessage));
    } finally {
      setSending(false);
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
        className="flex w-[280px] flex-col border-r border-white/6 bg-linear-to-b from-zinc-950 via-saas-primary/8 to-zinc-900/98 backdrop-blur-sm"
      >
        <div className="p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold tracking-wide text-white">Chats</h2>
            <motion.button
              type="button"
              onClick={() => void createNewChat()}
              disabled={loadingChats}
              {...(!loadingChats ? buttonMotion : {})}
              className="rounded-xl bg-linear-to-br from-saas-primary to-saas-accent px-2 py-1 text-xs font-semibold text-white shadow-md shadow-saas-primary/25 transition-shadow duration-200 hover:shadow-lg hover:shadow-saas-primary/30 disabled:opacity-70"
            >
              New
            </motion.button>
          </div>

          <div className="mt-3">
            {loadingChats ? (
              <div className="rounded-xl border border-white/5 bg-zinc-950/30 px-3 py-6 text-center">
                <p className="text-xs text-zinc-500">Loading your chats…</p>
              </div>
            ) : chats.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-zinc-950/30 px-3 py-6 text-center">
                <p className="text-xs font-medium leading-relaxed text-zinc-300">
                  Upload your first file to get started
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                  Tap <span className="text-zinc-400">New</span>, then upload a CSV or Excel file.
                </p>
              </div>
            ) : (
              <ul className="mt-2 max-h-[calc(100vh-220px)] space-y-2 overflow-auto pr-1">
                {chats.map((c) => {
                  const isActive = c.id === selectedChatId;
                  return (
                    <motion.li
                      key={c.id}
                      whileHover={{ scale: 1.015 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      className={`group cursor-pointer rounded-xl border px-3 py-2 text-xs transition-colors duration-200 ${
                        isActive
                          ? "border-saas-primary/35 bg-linear-to-br from-zinc-800/90 to-saas-primary/20 border-l-2 border-l-saas-accent shadow-md shadow-saas-primary/15"
                          : "border-zinc-800/80 bg-zinc-900/35 backdrop-blur-sm hover:border-saas-primary/25 hover:bg-zinc-900/60 hover:shadow-md"
                      }`}
                      onClick={() => setSelectedChatId(c.id)}
                      title={c.file_name ?? "New chat"}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
              {editingChatId === c.id ? (
                <input
                  autoFocus
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={() => cancelRename()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitRename(c.id);
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      cancelRename();
                    }
                  }}
                  className="w-full min-w-0 truncate rounded-lg border border-zinc-700/80 bg-zinc-950/80 px-2 py-1 text-[11px] text-zinc-100 outline-none transition-all duration-200 focus:border-saas-primary/50 focus:ring-2 focus:ring-saas-primary/25 focus:ring-offset-0"
                  aria-label="Rename chat"
                />
              ) : (
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    disabled={!c.can_edit}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!c.can_edit) return;
                      setEditingChatId(c.id);
                      setEditingTitle(titleOverrides[c.id] ?? c.file_name ?? "New chat");
                    }}
                    className="min-w-0 truncate font-medium text-zinc-100 hover:text-white disabled:opacity-60"
                    title={c.file_name ?? "New chat"}
                  >
                    {titleOverrides[c.id] ?? c.file_name ?? "New chat"}
                  </button>

                  {c.can_edit ? (
                    <button
                      type="button"
                      aria-label="Edit title"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingChatId(c.id);
                        setEditingTitle(titleOverrides[c.id] ?? c.file_name ?? "New chat");
                      }}
                      className="rounded-md p-1 text-[12px] text-zinc-400 transition hover:text-zinc-100 hover:bg-zinc-900/60"
                      title="Rename"
                    >
                      ✏️
                    </button>
                  ) : null}
                </div>
              )}
                          <p className="mt-1 text-[11px] text-zinc-400">
                            {(c.created_at ?? "").slice(0, 10)}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="hidden rounded-lg px-2 py-1 text-[11px] font-semibold text-zinc-300 group-hover:block hover:text-zinc-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (c.is_owner) void deleteChat(c.id);
                          }}
                          aria-label="Delete chat"
                        >
                          ✕
                        </button>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-auto p-4">
          <DashboardAuthActions />
        </div>
      </motion.aside>

      <motion.section {...fadeInUpDelayed} className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-white/6 bg-zinc-950/30 px-6 py-6 backdrop-blur-sm">
          <div>
            <h1 className="text-lg font-semibold text-white">DataChat AI</h1>
            <p className="text-xs text-zinc-400">
              Upload a file, then chat. Switch chats from the sidebar.
            </p>
          </div>
          {selectedChat ? (
            <div className="max-w-[320px] truncate rounded-xl border border-white/8 bg-linear-to-br from-zinc-900/90 to-saas-primary/10 px-3 py-2 text-xs text-zinc-200 shadow-md shadow-black/20 backdrop-blur-sm">
              {editingChatId === selectedChat.id ? (
                <input
                  autoFocus
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={() => cancelRename()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitRename(selectedChat.id);
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      cancelRename();
                    }
                  }}
                  className="w-full rounded-lg border border-zinc-700/80 bg-zinc-950/80 px-2 py-1 text-xs text-zinc-100 outline-none transition-all duration-200 focus:border-saas-primary/50 focus:ring-2 focus:ring-saas-primary/25 focus:ring-offset-0"
                  aria-label="Rename selected chat"
                />
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {titleOverrides[selectedChat.id] ?? selectedChat.file_name ?? "New chat"}
                  </span>
                  {selectedChat.can_edit ? (
                    <button
                      type="button"
                      aria-label="Edit title"
                      onClick={() => {
                        setEditingChatId(selectedChat.id);
                        setEditingTitle(
                          titleOverrides[selectedChat.id] ??
                            selectedChat.file_name ??
                            "New chat",
                        );
                      }}
                      className="rounded-md p-1 text-[12px] text-zinc-400 transition hover:text-zinc-100 hover:bg-zinc-900/60"
                      title="Rename"
                    >
                      ✏️
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          {selectedChat?.is_owner ? (
            <div className="flex items-center gap-3">
              <select
                value={sharePermission}
                onChange={(e) =>
                  setSharePermission(e.target.value as "view" | "edit")
                }
                className="rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-3 py-2 text-xs text-zinc-100 outline-none transition-all duration-200 focus:border-saas-primary/50 focus:ring-2 focus:ring-saas-primary/25 focus:ring-offset-0"
                disabled={shareLoading}
                aria-label="Share permission"
              >
                <option value="view">View only</option>
                <option value="edit">Edit</option>
              </select>
              <motion.button
                type="button"
                onClick={async () => {
                  if (!token || !selectedChatId) return;
                  setShareError(null);
                  setShareLoading(true);
                  setShareLink(null);
                  setShowShareLinkContainer(false);
                  try {
                    const apiBase =
                      process.env.NEXT_PUBLIC_API_BASE_URL?.replace(
                        /\/$/,
                        "",
                      ) ?? "http://localhost:8000/api";
                    const resp = await fetch(
                      `${apiBase}/chats/${selectedChatId}/share-link`,
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                          permission: sharePermission,
                        }),
                      },
                    );
                    if (!resp.ok) {
                      const data = await resp.json().catch(() => null);
                      throw new Error(data?.detail ?? UserMessage.share);
                    }
                    const data = (await resp.json()) as { share_token: string };
                    const link = `${window.location.origin}/share?token=${encodeURIComponent(
                      data.share_token,
                    )}`;
                    setShareLink(link);
                    setShowShareLinkContainer(true);
                  } catch (err) {
                    setShareError(userFacingError(err, UserMessage.share));
                  } finally {
                    setShareLoading(false);
                  }
                }}
                disabled={shareLoading}
                {...(!shareLoading ? buttonMotion : {})}
                className="rounded-xl bg-linear-to-br from-saas-primary to-saas-accent px-3 py-2 text-xs font-semibold text-white shadow-md shadow-saas-primary/25 transition-shadow duration-200 hover:shadow-lg hover:shadow-saas-primary/30 disabled:opacity-70"
              >
                {shareLoading ? "Creating…" : "Share"}
              </motion.button>
            </div>
          ) : null}
        </header>

        {shareError ? (
          <div className="mx-6 mt-4 rounded-xl border border-rose-900/50 bg-rose-950/20 px-4 py-3 text-sm text-rose-200">
            {shareError}
          </div>
        ) : null}

        {shareLink && showShareLinkContainer ? (
          <motion.div
            {...fadeIn}
            className="relative mx-6 mt-3 flex flex-col gap-2 rounded-2xl border border-white/8 bg-linear-to-br from-zinc-900/95 to-saas-primary/12 px-4 py-3 shadow-lg shadow-black/25 backdrop-blur-sm transition-all duration-300 hover:scale-[1.002] hover:shadow-xl hover:shadow-saas-primary/15"
          >
            <button
              type="button"
              onClick={() => setShowShareLinkContainer(false)}
              aria-label="Close share link"
              className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950/40 text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900"
            >
              ✕
            </button>
            <p className="pr-8 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-300">
              Share link
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                readOnly
                value={shareLink}
                className="min-w-[260px] flex-1 rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-3 py-2 text-xs text-zinc-100 outline-none transition-all duration-200 focus:border-saas-primary/50 focus:ring-2 focus:ring-saas-primary/25 focus:ring-offset-0"
              />
              <motion.button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareLink);
                  } catch {
                    // ignore clipboard errors
                  }
                }}
                {...buttonMotion}
                className="rounded-xl bg-linear-to-br from-saas-primary to-saas-accent px-3 py-2 text-xs font-semibold text-white shadow-md shadow-saas-primary/25 transition-shadow duration-200 hover:shadow-lg hover:shadow-saas-primary/30"
              >
                Copy
              </motion.button>
            </div>
          </motion.div>
        ) : null}

        {error ? (
          <div className="mx-6 mt-4 rounded-xl border border-rose-900/50 bg-rose-950/20 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <div className="flex-1 overflow-auto px-6 py-8">
          {!selectedChat ? (
            <motion.div
              {...fadeIn}
              className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-white/8 bg-linear-to-br from-zinc-900/85 to-saas-primary/10 px-8 py-12 text-center shadow-xl shadow-black/20 backdrop-blur-sm"
            >
              {loadingChats ? (
                <p className="text-sm text-zinc-500">Loading your workspace…</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-zinc-300">Select a chat to begin</p>
                  <p className="mt-2 max-w-sm text-xs leading-relaxed text-zinc-500">
                    Pick a session from the sidebar, or create one with{" "}
                    <span className="text-zinc-400">New</span> to upload data.
                  </p>
                </>
              )}
            </motion.div>
          ) : !selectedChat.file_url ? (
            <motion.div
              {...fadeIn}
              className="mx-auto w-full max-w-2xl rounded-2xl border border-white/8 bg-linear-to-br from-zinc-900/95 via-zinc-900/70 to-saas-primary/12 p-8 shadow-xl shadow-black/25 backdrop-blur-sm transition-all duration-300 hover:scale-[1.01] hover:border-white/12 hover:shadow-2xl hover:shadow-saas-primary/15"
            >
              <h2 className="text-lg font-semibold text-white">Upload File</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Upload a CSV or Excel file to start. We’ll use it to generate insights and answer questions.
              </p>

              <div className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-zinc-200">Choose file</span>
                  <input
                    type="file"
                    accept=".csv,.xls,.xlsx"
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                    className="w-full cursor-pointer rounded-xl border border-zinc-700/80 bg-zinc-950/80 p-3 text-sm text-zinc-100 outline-none transition-all duration-200 focus:border-saas-primary/50 focus:ring-2 focus:ring-saas-primary/25 focus:ring-offset-0"
                    disabled={!selectedChat.can_edit}
                  />
                  {uploadFile ? (
                    <p className="mt-2 text-xs text-zinc-400">{uploadFile.name}</p>
                  ) : null}
                </label>

                <motion.button
                  type="button"
                  onClick={() => void handleUpload()}
                  disabled={uploading || !selectedChat.can_edit}
                  {...(!uploading && selectedChat.can_edit ? buttonMotion : {})}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-br from-saas-primary to-saas-accent px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-saas-primary/25 transition-shadow duration-200 hover:shadow-xl hover:shadow-saas-primary/35 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {uploading ? (
                    <>
                      <ButtonSpinner className="border-white" />
                      Uploading...
                    </>
                  ) : (
                    "Upload & Start Chat"
                  )}
                </motion.button>
              </div>
              {!selectedChat.can_edit ? (
                <p className="mt-4 text-sm text-rose-300">
                  You have view-only access to this chat.
                </p>
              ) : null}
            </motion.div>
          ) : (
            <motion.div {...fadeIn} className="mx-auto flex w-full max-w-3xl flex-col">
              {token ? (
                <InsightsCharts
                  token={token}
                  chatId={selectedChatId}
                  datasetVersion={selectedChat.file_url}
                />
              ) : null}
              <div className="flex-1 overflow-auto rounded-2xl border border-white/8 bg-linear-to-br from-zinc-900/92 via-zinc-900/65 to-saas-primary/10 px-4 py-4 shadow-inner shadow-black/30 backdrop-blur-sm">
                {loadingMessages ? (
                  <div className="flex min-h-[200px] items-center justify-center py-10">
                    <p className="text-sm text-zinc-500">Loading messages…</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex min-h-[220px] flex-col items-center justify-center px-4 py-12 text-center">
                    <p className="text-sm font-medium text-zinc-300">Ask a question to explore insights</p>
                    <p className="mt-2 max-w-md text-xs leading-relaxed text-zinc-500">
                      Your conversation will appear here. Try asking about trends, totals, or filters.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((m) => {
                      const isUser = m.role === "user";
                      return (
                        <div
                          key={m.id}
                          className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                        >
                          <motion.div
                            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl border px-4 py-3 text-sm ${
                              isUser
                                ? "border-saas-primary/30 bg-linear-to-br from-saas-primary/15 to-saas-accent/10 text-zinc-50 shadow-md shadow-saas-primary/15"
                                : "border-zinc-700/80 bg-zinc-950/70 text-zinc-100 backdrop-blur-sm"
                            }`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35 }}
                          >
                            {m.content}
                          </motion.div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="mt-4 flex items-end gap-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Ask about your data..."
                  rows={1}
                  disabled={!selectedChat.can_edit}
                  className="min-h-[46px] flex-1 resize-none rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 outline-none transition-all duration-200 focus:border-saas-primary/50 focus:ring-2 focus:ring-saas-primary/25 focus:ring-offset-0"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                />
                <motion.button
                  type="button"
                  disabled={sending || !selectedChat.can_edit}
                  onClick={() => void sendMessage()}
                  {...(!sending && selectedChat.can_edit ? buttonMotion : {})}
                  className="rounded-xl bg-linear-to-br from-saas-primary to-saas-accent px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-saas-primary/25 transition-shadow duration-200 hover:shadow-xl hover:shadow-saas-primary/35 disabled:opacity-70"
                >
                  {sending ? "Sending…" : "Send"}
                </motion.button>
              </div>
              <p className="mt-3 text-xs text-zinc-500">
                Tip: press Enter to send, Shift+Enter for a new line.
              </p>
            </motion.div>
          )}
        </div>
      </motion.section>
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
