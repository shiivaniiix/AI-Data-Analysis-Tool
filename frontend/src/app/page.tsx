"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { buttonMotion, fadeInUp } from "@/lib/motion-presets";

const features = [
  {
    icon: "📊",
    title: "Upload CSV & Excel",
    desc: "Bring your spreadsheets — we support common CSV and Excel formats.",
  },
  {
    icon: "🤖",
    title: "Ask in plain English",
    desc: "No SQL required. Ask questions naturally and get answers from your data.",
  },
  {
    icon: "📈",
    title: "Insights & charts",
    desc: "Auto-generated summaries, visuals, and trends to explore faster.",
  },
  {
    icon: "🔒",
    title: "Secure & private",
    desc: "Your files are handled securely and never shared with others.",
  },
] as const;

const faqs = [
  {
    q: "What files can I upload?",
    a: "CSV and Excel files are supported.",
  },
  {
    q: "Is my data सुरक्षित?",
    a: "Yes, your data is processed securely and not shared.",
  },
  {
    q: "Why am I not receiving OTP?",
    a: "Check spam folder or use resend option.",
  },
  {
    q: "How does this work?",
    a: "Upload your file and ask questions — AI handles the rest.",
  },
] as const;

/** Placeholder while auth is unknown — matches footprint of Login + Get Started (SSR-safe). */
function NavbarAuthSkeleton() {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3" aria-hidden>
      <div className="h-9 w-16 animate-pulse rounded-xl bg-zinc-800/90" />
      <div className="h-9 w-[7.25rem] animate-pulse rounded-xl bg-zinc-800/90" />
    </div>
  );
}

function HeroCtaSkeleton() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4" aria-hidden>
      <div className="h-12 w-36 animate-pulse rounded-xl bg-zinc-800/90 sm:w-40" />
      <div className="h-12 w-28 animate-pulse rounded-xl bg-zinc-800/90 sm:w-32" />
    </div>
  );
}

function CtaButtonSkeleton() {
  return (
    <div className="inline-block" aria-hidden>
      <div className="h-12 w-56 animate-pulse rounded-xl bg-zinc-800/90 sm:w-64" />
    </div>
  );
}

export default function Home() {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [helpOpen, setHelpOpen] = useState(false);

  const closeHelp = useCallback(() => setHelpOpen(false), []);

  useEffect(() => {
    if (!helpOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeHelp();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [helpOpen, closeHelp]);

  return (
    <div className="flex min-h-screen flex-col bg-linear-to-b from-zinc-950 via-zinc-950 to-zinc-900 text-zinc-100">
      {/* Navbar */}
      <header className="sticky top-0 z-40 border-b border-white/6 bg-zinc-950/80 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-white transition hover:text-saas-accent"
          >
            DataChat AI
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm font-medium text-zinc-200 transition-all duration-200 hover:border-saas-primary/40 hover:bg-zinc-800/80"
            >
              Help
            </button>
            {authLoading ? (
              <NavbarAuthSkeleton />
            ) : isLoggedIn ? (
              <motion.div {...buttonMotion}>
                <Link
                  href="/dashboard"
                  className="inline-block rounded-xl bg-linear-to-br from-saas-primary to-saas-accent px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-saas-primary/20"
                >
                  Dashboard
                </Link>
              </motion.div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-xl px-3 py-2 text-sm font-medium text-zinc-300 transition hover:text-white"
                >
                  Login
                </Link>
                <motion.div {...buttonMotion}>
                  <Link
                    href="/signup"
                    className="inline-block rounded-xl bg-linear-to-br from-saas-primary to-saas-accent px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-saas-primary/20"
                  >
                    Get Started
                  </Link>
                </motion.div>
              </>
            )}
          </div>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden px-4 py-20 sm:px-6 sm:py-28">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            aria-hidden
          >
            <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-linear-to-br from-saas-primary/30 via-transparent to-saas-accent/20 blur-3xl" />
          </div>
          <motion.div
            {...fadeInUp}
            className="relative mx-auto max-w-3xl text-center"
          >
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-saas-accent/90">
              Codezista
            </p>
            <h1 className="bg-linear-to-r from-white via-saas-primary/90 to-saas-accent bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl md:text-6xl">
              Chat with your data. Instantly.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400 sm:text-xl">
              Upload spreadsheets, ask questions, and get insights in seconds using AI.
            </p>
            <div className="mt-10 flex min-h-[3rem] flex-wrap items-center justify-center gap-4">
              {authLoading ? (
                <HeroCtaSkeleton />
              ) : isLoggedIn ? (
                <motion.div {...buttonMotion}>
                  <Link
                    href="/dashboard"
                    className="inline-flex rounded-xl bg-linear-to-br from-saas-primary to-saas-accent px-8 py-3.5 text-base font-semibold text-white shadow-xl shadow-saas-primary/25 transition-shadow hover:shadow-2xl hover:shadow-saas-primary/35"
                  >
                    Go to Dashboard
                  </Link>
                </motion.div>
              ) : (
                <>
                  <motion.div {...buttonMotion}>
                    <Link
                      href="/signup"
                      className="inline-flex rounded-xl bg-linear-to-br from-saas-primary to-saas-accent px-8 py-3.5 text-base font-semibold text-white shadow-xl shadow-saas-primary/25"
                    >
                      Get Started
                    </Link>
                  </motion.div>
                  <motion.div {...buttonMotion}>
                    <Link
                      href="/login"
                      className="inline-flex rounded-xl border border-white/15 bg-zinc-900/50 px-8 py-3.5 text-base font-semibold text-zinc-100 shadow-lg backdrop-blur transition hover:border-saas-accent/35 hover:bg-zinc-800/60"
                    >
                      Login
                    </Link>
                  </motion.div>
                </>
              )}
            </div>
          </motion.div>
        </section>

        {/* Features */}
        <section className="border-t border-white/6 bg-zinc-950/50 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="text-center text-2xl font-semibold text-white sm:text-3xl"
            >
              Everything you need
            </motion.h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-zinc-500">
              Built for analysts, founders, and teams who want answers — not another dashboard to learn.
            </p>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="rounded-2xl border border-white/8 bg-linear-to-br from-zinc-900/90 to-saas-primary/10 p-6 shadow-lg shadow-black/20 transition-shadow duration-300 hover:border-white/12 hover:shadow-xl hover:shadow-saas-primary/10"
                >
                  <span className="text-3xl" aria-hidden>
                    {f.icon}
                  </span>
                  <h3 className="mt-4 font-semibold text-white">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 py-20 sm:px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
            className="mx-auto max-w-4xl rounded-2xl border border-white/8 bg-linear-to-br from-saas-primary/20 via-zinc-900/80 to-saas-accent/15 p-10 text-center shadow-2xl shadow-saas-primary/15 sm:p-14"
          >
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">
              Start analyzing your data today
            </h2>
            <p className="mx-auto mt-3 max-w-md text-zinc-400">
              Join in minutes. No credit card required to explore.
            </p>
            <div className="mt-8 flex min-h-[3rem] justify-center">
              {authLoading ? (
                <CtaButtonSkeleton />
              ) : isLoggedIn ? (
                <motion.div {...buttonMotion} className="inline-block">
                  <Link
                    href="/dashboard"
                    className="inline-flex rounded-xl bg-linear-to-br from-saas-primary to-saas-accent px-10 py-3.5 text-base font-semibold text-white shadow-xl"
                  >
                    Open Dashboard
                  </Link>
                </motion.div>
              ) : (
                <motion.div {...buttonMotion} className="inline-block">
                  <Link
                    href="/signup"
                    className="inline-flex rounded-xl bg-linear-to-br from-saas-primary to-saas-accent px-10 py-3.5 text-base font-semibold text-white shadow-xl"
                  >
                    Create Free Account
                  </Link>
                </motion.div>
              )}
            </div>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/6 py-8 text-center text-sm text-zinc-500">
        © 2026 DataChat AI. All rights reserved.
      </footer>

      {/* Help modal */}
      <AnimatePresence>
        {helpOpen ? (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-modal-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={closeHelp}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.25 }}
              className="relative max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={closeHelp}
                className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300 transition hover:border-saas-primary/50 hover:bg-zinc-800 hover:text-white"
                aria-label="Close"
              >
                ✕
              </button>
              <div className="p-6 pt-14 sm:p-8">
                <h2
                  id="help-modal-title"
                  className="text-xl font-semibold text-white"
                >
                  Help & FAQs
                </h2>
                <ul className="mt-6 space-y-5 text-left">
                  {faqs.map((item) => (
                    <li key={item.q}>
                      <p className="font-medium text-saas-accent/95">Q: {item.q}</p>
                      <p className="mt-1 text-sm leading-relaxed text-zinc-400">A: {item.a}</p>
                    </li>
                  ))}
                </ul>
                <div className="mt-8 border-t border-white/10 pt-6">
                  <p className="text-sm font-medium text-zinc-300">For more queries:</p>
                  <p className="mt-3 text-sm text-zinc-400">
                    Email:{" "}
                    <a
                      href="mailto:ashokshivani875@gmail.com"
                      className="text-saas-accent underline-offset-2 hover:underline"
                    >
                      ashokshivani875@gmail.com
                    </a>
                  </p>
                  <p className="mt-2 text-sm text-zinc-400">
                    Phone:{" "}
                    <a href="tel:+919699617331" className="text-zinc-300 hover:text-white">
                      +91 9699617331
                    </a>
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
