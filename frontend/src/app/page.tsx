"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";

import { fadeInUp } from "@/lib/motion-presets";

export default function Home() {
  const [isAuthed] = useState(() => {
    // Token is stored client-side for now; presence means the user is "logged in".
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem("datachat_token");
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-linear-to-br from-zinc-950 via-saas-primary/10 to-zinc-950 px-6 py-20 text-zinc-100">
      <motion.section
        {...fadeInUp}
        className="w-full max-w-5xl rounded-3xl border border-white/[0.08] bg-linear-to-br from-zinc-900/90 via-zinc-900/70 to-saas-primary/15 p-8 shadow-2xl shadow-saas-primary/15 backdrop-blur-xl transition-all duration-300 hover:scale-[1.002] hover:border-white/12 hover:shadow-saas-primary/20 md:p-14"
      >
        <p className="mb-4 inline-flex rounded-full border border-saas-primary/30 bg-saas-primary/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-saas-accent/90">
          Codezista
        </p>
        <h1 className="max-w-3xl bg-linear-to-r from-zinc-50 via-saas-primary/90 to-saas-accent bg-clip-text text-4xl font-semibold tracking-tight text-transparent md:text-6xl">
          DataChat AI turns CSV and Excel files into instant insights.
        </h1>
        <p className="mt-6 max-w-2xl text-base text-zinc-300 md:text-lg">
          Upload datasets, auto-generate visual analytics, and chat with your data
          using a modern AI-powered workspace.
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          {isAuthed ? (
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.2 }}>
              <Link
                href="/dashboard"
                className="inline-block rounded-full bg-linear-to-br from-saas-primary to-saas-accent px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-saas-primary/25 transition-shadow duration-200 hover:shadow-xl hover:shadow-saas-primary/35"
              >
                Go to Dashboard
              </Link>
            </motion.div>
          ) : (
            <>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.2 }}>
                <Link
                  href="/signup"
                  className="inline-block rounded-full bg-linear-to-br from-saas-primary to-saas-accent px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-saas-primary/25 transition-shadow duration-200 hover:shadow-xl hover:shadow-saas-primary/35"
                >
                  Start Free
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.2 }}>
                <Link
                  href="/login"
                  className="inline-block rounded-full border border-saas-primary/35 bg-zinc-950/50 px-6 py-3 text-sm font-semibold text-zinc-100 shadow-md shadow-black/20 backdrop-blur transition-all duration-200 hover:scale-[1.02] hover:border-saas-accent/40 hover:bg-zinc-900/70"
                >
                  Log In
                </Link>
              </motion.div>
            </>
          )}
        </div>
      </motion.section>
    </main>
  );
}
