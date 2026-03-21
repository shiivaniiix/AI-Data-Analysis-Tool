"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";
import { UserMessage, userFacingError } from "@/lib/user-messages";
import { buttonMotion, fadeInUp } from "@/lib/motion-presets";
import { clearSession, getToken, getUsername } from "@/utils/storage";

export function DashboardAuthActions() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    setUsername(getUsername());
  }, []);

  const logout = () => {
    clearSession();
    router.push("/login");
  };

  const handleDeleteAccount = async () => {
    const token = getToken();
    if (!token) {
      setError(UserMessage.notLoggedIn);
      return;
    }
    if (!password) {
      setError(UserMessage.needPassword);
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
      setError(userFacingError(err, UserMessage.deleteAccount));
    } finally {
      setLoadingDelete(false);
    }
  };

  return (
    <motion.div
      {...fadeInUp}
      className="rounded-2xl border border-white/8 bg-linear-to-br from-zinc-900/92 via-zinc-900/72 to-saas-primary/10 p-5 shadow-xl shadow-black/25 backdrop-blur-sm transition-all duration-300 hover:border-white/10 hover:shadow-saas-primary/10"
    >
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-400">Account</h2>
      <p className="mt-3 text-sm text-zinc-300">
        Signed in as <span className="font-semibold text-zinc-100">{username ?? "Unknown"}</span>
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <motion.button
          type="button"
          onClick={logout}
          {...buttonMotion}
          className="rounded-xl border border-saas-primary/30 bg-zinc-950/50 px-4 py-2 text-sm font-semibold text-zinc-100 shadow-md shadow-black/20 transition-all duration-200 hover:scale-[1.02] hover:border-saas-accent/40 hover:bg-zinc-900/60"
        >
          Logout
        </motion.button>
      </div>
      <div className="mt-6 space-y-3 rounded-xl border border-rose-900/40 bg-rose-950/20 p-4">
        <p className="text-sm font-semibold text-rose-300">Danger zone</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950/90 px-3 py-2 text-sm text-zinc-100 outline-none transition-all duration-200 focus:border-saas-primary/50 focus:ring-2 focus:ring-saas-primary/25 focus:ring-offset-0"
          placeholder="Enter password to confirm account deletion"
        />
        <motion.button
          type="button"
          onClick={handleDeleteAccount}
          disabled={loadingDelete}
          {...(!loadingDelete ? buttonMotion : {})}
          className="rounded-xl bg-linear-to-br from-rose-600 to-saas-primary px-4 py-2 text-sm font-semibold text-white shadow-md shadow-rose-900/35 transition-shadow duration-200 hover:shadow-lg hover:shadow-rose-900/45 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loadingDelete ? "Deleting..." : "Delete account"}
        </motion.button>
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      </div>
    </motion.div>
  );
}
