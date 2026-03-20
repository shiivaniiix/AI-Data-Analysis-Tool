"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { DashboardAuthActions } from "@/components/dashboard-auth-actions";
import { ApiError, apiRequest, apiUpload } from "@/lib/api";
import { InsightsCharts } from "@/components/insights-charts";

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
  const [token, setToken] = useState<string | null>(null);
  const [tokenLoaded, setTokenLoaded] = useState(false);
  const [newChatIdFromLogin, setNewChatIdFromLogin] = useState<string | null>(null);

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

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setToken(localStorage.getItem("datachat_token"));
    setNewChatIdFromLogin(localStorage.getItem("datachat_new_chat_id"));
    setTokenLoaded(true);
  }, []);

  useEffect(() => {
    if (!tokenLoaded) return;
    if (!token) {
      router.push("/login");
      return;
    }
    void loadChats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenLoaded, token]);

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
        localStorage.removeItem("datachat_new_chat_id");
        setNewChatIdFromLogin(null);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load chats.");
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
      setError(err instanceof ApiError ? err.message : "Unable to load messages.");
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
      setError(err instanceof ApiError ? err.message : "Unable to create a new chat.");
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
      setError(err instanceof ApiError ? err.message : "Unable to delete chat.");
    }
  };

  const handleUpload = async () => {
    if (!token || !selectedChatId) return;
    if (!uploadFile) {
      setError("Select a CSV or Excel file first.");
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
      setError(err instanceof ApiError ? err.message : "Upload failed.");
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
          throw new Error(data?.detail ?? "Export failed.");
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
      setError(err instanceof ApiError ? err.message : "Unable to send message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="flex h-screen bg-gradient-to-br from-zinc-950 via-zinc-950 to-purple-950 text-zinc-100">
      <aside className="flex w-[280px] flex-col border-r border-zinc-800 bg-gradient-to-b from-zinc-950 to-zinc-900">
        <div className="p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold tracking-wide text-white">Chats</h2>
            <button
              type="button"
              onClick={() => void createNewChat()}
              disabled={loadingChats}
              className="rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 px-2 py-1 text-xs font-semibold text-white shadow-sm transition hover:shadow-md disabled:opacity-70"
            >
              New
            </button>
          </div>

          <div className="mt-3">
            {loadingChats ? (
              <p className="text-xs text-zinc-400">Loading…</p>
            ) : chats.length === 0 ? (
              <p className="text-xs text-zinc-400">No chats yet.</p>
            ) : (
              <ul className="mt-2 max-h-[calc(100vh-220px)] space-y-2 overflow-auto pr-1">
                {chats.map((c) => {
                  const isActive = c.id === selectedChatId;
                  return (
                    <li
                      key={c.id}
                      className={`group cursor-pointer rounded-xl border px-3 py-2 text-xs transition ${
                        isActive
                          ? "border-zinc-700 bg-zinc-800 border-l-2 border-blue-500"
                          : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/60"
                      }`}
                      onClick={() => setSelectedChatId(c.id)}
                      title={c.file_name ?? "New chat"}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-zinc-100">
                            {c.file_name ?? "New chat"}
                          </p>
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
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-auto p-4">
          <DashboardAuthActions />
        </div>
      </aside>

      <section className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-6">
          <div>
            <h1 className="text-lg font-semibold text-white">DataChat AI</h1>
            <p className="text-xs text-zinc-400">
              Upload a file, then chat. Switch chats from the sidebar.
            </p>
          </div>
          {selectedChat?.file_name ? (
            <div className="max-w-[320px] truncate rounded-lg border border-zinc-700 bg-gradient-to-br from-zinc-900 to-zinc-800/30 px-3 py-2 text-xs text-zinc-200">
              {selectedChat.file_name}
            </div>
          ) : null}

          {selectedChat?.is_owner ? (
            <div className="flex items-center gap-3">
              <select
                value={sharePermission}
                onChange={(e) =>
                  setSharePermission(e.target.value as "view" | "edit")
                }
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                disabled={shareLoading}
                aria-label="Share permission"
              >
                <option value="view">View only</option>
                <option value="edit">Edit</option>
              </select>
              <button
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
                      throw new Error(data?.detail ?? "Unable to create share link.");
                    }
                    const data = (await resp.json()) as { share_token: string };
                    const link = `${window.location.origin}/share?token=${encodeURIComponent(
                      data.share_token,
                    )}`;
                    setShareLink(link);
                    setShowShareLinkContainer(true);
                  } catch (err) {
                    setShareError(err instanceof Error ? err.message : "Unable to share chat.");
                  } finally {
                    setShareLoading(false);
                  }
                }}
                disabled={shareLoading}
                className="rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:shadow-md disabled:opacity-70"
              >
                {shareLoading ? "Creating…" : "Share"}
              </button>
            </div>
          ) : null}
        </header>

        {shareError ? (
          <div className="mx-6 mt-4 rounded-xl border border-rose-900/50 bg-rose-950/20 px-4 py-3 text-sm text-rose-200">
            {shareError}
          </div>
        ) : null}

        {shareLink && showShareLinkContainer ? (
          <div className="mx-6 mt-3 relative flex flex-col gap-2 rounded-xl border border-zinc-700 bg-gradient-to-br from-zinc-900 to-zinc-800/30 px-4 py-3 shadow-sm transition hover:shadow-lg hover:scale-[1.01]">
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
                className="flex-1 min-w-[260px] rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareLink);
                  } catch {
                    // ignore clipboard errors
                  }
                }}
                className="rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:shadow-md"
              >
                Copy
              </button>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mx-6 mt-4 rounded-xl border border-rose-900/50 bg-rose-950/20 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <div className="flex-1 overflow-auto px-6 py-8">
          {!selectedChat ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-sm text-zinc-300">
              {loadingChats ? "Loading chats…" : "Select a chat to begin."}
            </div>
          ) : !selectedChat.file_url ? (
            <div className="mx-auto w-full max-w-2xl rounded-2xl border border-zinc-700 bg-gradient-to-br from-zinc-900 to-zinc-800/30 p-8 shadow-sm hover:shadow-lg hover:scale-[1.01] transition">
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
                    className="w-full cursor-pointer rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    disabled={!selectedChat.can_edit}
                  />
                  {uploadFile ? (
                    <p className="mt-2 text-xs text-zinc-400">{uploadFile.name}</p>
                  ) : null}
                </label>

                <button
                  type="button"
                  onClick={() => void handleUpload()}
                  disabled={uploading || !selectedChat.can_edit}
                  className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:opacity-70"
                >
                  {uploading ? "Uploading…" : "Upload & Start Chat"}
                </button>
              </div>
              {!selectedChat.can_edit ? (
                <p className="mt-4 text-sm text-rose-300">
                  You have view-only access to this chat.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col">
              {token ? (
                <InsightsCharts
                  token={token}
                  chatId={selectedChatId}
                  datasetVersion={selectedChat.file_url}
                />
              ) : null}
              <div className="flex-1 overflow-auto rounded-2xl border border-zinc-700 bg-gradient-to-br from-zinc-900 to-zinc-800/20 px-4 py-4">
                {loadingMessages ? (
                  <p className="py-6 text-sm text-zinc-400">Loading messages…</p>
                ) : messages.length === 0 ? (
                  <div className="py-10 text-center text-sm text-zinc-400">
                    No messages yet. Ask your first question about the file.
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
                          <div
                            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl border px-4 py-3 text-sm ${
                              isUser
                                ? "border-blue-500/40 bg-blue-900/20 text-zinc-50"
                                : "border-zinc-700 bg-zinc-950/60 text-zinc-100"
                            }`}
                          >
                            {m.content}
                          </div>
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
                  className="min-h-[46px] flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={sending || !selectedChat.can_edit}
                  onClick={() => void sendMessage()}
                  className="rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:opacity-70"
                >
                  {sending ? "Sending…" : "Send"}
                </button>
              </div>
              <p className="mt-3 text-xs text-zinc-500">
                Tip: press Enter to send, Shift+Enter for a new line.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-10 text-zinc-200">
          <p className="text-sm text-zinc-400">Loading dashboard…</p>
        </main>
      }
    >
      <DashboardPageContent />
    </Suspense>
  );
}
