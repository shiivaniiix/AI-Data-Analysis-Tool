"use client";

import Link from "next/link";
import { useState } from "react";

export default function Home() {
  const [isAuthed] = useState(() => {
    // Token is stored client-side for now; presence means the user is "logged in".
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem("datachat_token");
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-20 text-zinc-100">
      <section className="w-full max-w-5xl rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl backdrop-blur md:p-14">
        <p className="mb-4 inline-flex rounded-full border border-zinc-700 px-3 py-1 text-xs uppercase tracking-[0.2em] text-zinc-300">
          Codezista
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
          DataChat AI turns CSV and Excel files into instant insights.
        </h1>
        <p className="mt-6 max-w-2xl text-base text-zinc-300 md:text-lg">
          Upload datasets, auto-generate visual analytics, and chat with your data
          using a modern AI-powered workspace.
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          {isAuthed ? (
            <Link
              href="/dashboard"
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/signup"
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200"
              >
                Start Free
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500"
              >
                Log In
              </Link>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
