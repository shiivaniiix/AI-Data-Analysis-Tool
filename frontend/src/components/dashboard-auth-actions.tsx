"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";

export function DashboardAuthActions() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const username = useMemo(
    () => (typeof window !== "undefined" ? localStorage.getItem("datachat_username") : null),
    [],
  );

  const logout = () => {
    localStorage.removeItem("datachat_token");
    localStorage.removeItem("datachat_user_email");
    localStorage.removeItem("datachat_username");
    router.push("/login");
  };

  const handleDeleteAccount = async () => {
    const token = localStorage.getItem("datachat_token");
    if (!token) {
      setError("You are not logged in.");
      return;
    }
    if (!password) {
      setError("Please enter your password to delete your account.");
      return;
    }
    setLoadingDelete(true);
    setError(null);
    try {
      await apiRequest("/auth/delete-account", {
        method: "POST",
        token,
        body: { password },
      });
      logout();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to delete account.");
    } finally {
      setLoadingDelete(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-400">Account</h2>
      <p className="mt-3 text-sm text-zinc-300">
        Signed in as <span className="font-semibold text-zinc-100">{username ?? "Unknown"}</span>
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={logout}
          className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500"
        >
          Logout
        </button>
      </div>
      <div className="mt-6 space-y-3 rounded-xl border border-rose-900/40 bg-rose-950/20 p-4">
        <p className="text-sm font-semibold text-rose-300">Danger zone</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          placeholder="Enter password to confirm account deletion"
        />
        <button
          type="button"
          onClick={handleDeleteAccount}
          disabled={loadingDelete}
          className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loadingDelete ? "Deleting..." : "Delete account"}
        </button>
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      </div>
    </div>
  );
}
