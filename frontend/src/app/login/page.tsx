"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";

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
      setError(err instanceof ApiError ? err.message : "Unable to log in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-20">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8 shadow-xl">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Welcome back</h1>
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
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-zinc-500"
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
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-zinc-500"
              placeholder="Enter your password"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        {error ? <p className="mt-4 text-sm text-rose-400">{error}</p> : null}

        <p className="mt-6 text-sm text-zinc-400">
          New to DataChat AI?{" "}
          <Link href="/signup" className="font-medium text-zinc-100 hover:text-zinc-300">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
