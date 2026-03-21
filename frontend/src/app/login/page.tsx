"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ButtonSpinner } from "@/components/button-spinner";
import { apiRequest } from "@/lib/api";
import { UserMessage, userFacingError } from "@/lib/user-messages";
import { buttonMotion, fadeInUp } from "@/lib/motion-presets";

type LoginResponse = {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
  username: string;
  new_chat_id: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [isAuthed] = useState(() => {
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem("datachat_token");
  });
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthed) router.replace("/dashboard");
  }, [isAuthed, router]);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        body: { identifier, password },
      });
      localStorage.setItem("datachat_token", data.access_token);
      localStorage.setItem("datachat_user_email", data.email);
      localStorage.setItem("datachat_username", data.username);
      localStorage.setItem("datachat_new_chat_id", data.new_chat_id);
      router.push("/dashboard");
    } catch (err) {
      setError(userFacingError(err, UserMessage.login));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-linear-to-br from-zinc-950 via-saas-primary/10 to-zinc-950 px-6 py-20">
      <motion.div
        {...fadeInUp}
        className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-linear-to-br from-zinc-900/92 via-zinc-900/75 to-saas-primary/12 p-8 shadow-2xl shadow-saas-primary/15 backdrop-blur-xl transition-all duration-300 hover:border-white/10 hover:shadow-saas-primary/20"
      >
        <h1 className="bg-linear-to-r from-white via-saas-primary/80 to-saas-accent bg-clip-text text-2xl font-semibold tracking-tight text-transparent">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Log in with your email or username to continue.
        </p>
        <form className="mt-6 space-y-4" onSubmit={handleLogin}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-200">
              Email or Username
            </span>
            <input
              required
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950/90 px-3 py-2 text-zinc-100 outline-none transition-all duration-200 focus:border-saas-primary/50 focus:ring-2 focus:ring-saas-primary/25 focus:ring-offset-0"
              placeholder="you@company.com or username"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-200">Password</span>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950/90 px-3 py-2 text-zinc-100 outline-none transition-all duration-200 focus:border-saas-primary/50 focus:ring-2 focus:ring-saas-primary/25 focus:ring-offset-0"
              placeholder="Enter your password"
            />
          </label>
          <motion.button
            type="submit"
            disabled={loading}
            {...(!loading ? buttonMotion : {})}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-br from-saas-primary to-saas-accent px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-saas-primary/25 transition-shadow duration-200 hover:shadow-xl hover:shadow-saas-primary/35 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <>
                <ButtonSpinner className="border-white" />
                Signing in...
              </>
            ) : (
              "Log In"
            )}
          </motion.button>
        </form>

        {error ? <p className="mt-4 text-sm text-rose-400">{error}</p> : null}

        <p className="mt-6 text-sm text-zinc-400">
          New to DataChat AI?{" "}
          <Link
            href="/signup"
            className="font-medium text-saas-accent/90 transition-colors duration-200 hover:text-saas-primary"
          >
            Create an account
          </Link>
        </p>
      </motion.div>
    </main>
  );
}
