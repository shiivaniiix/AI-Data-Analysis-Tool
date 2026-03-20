"use client";

import Link from "next/link";
import { useState } from "react";

type AuthCardProps = {
  title: string;
  subtitle: string;
  submitLabel: string;
  altHref: string;
  altLabel: string;
  altText: string;
};

export function AuthCard({
  title,
  subtitle,
  submitLabel,
  altHref,
  altLabel,
  altText,
}: AuthCardProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8 shadow-xl">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">{title}</h1>
      <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>

      <form className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-zinc-200">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none ring-0 focus:border-zinc-500"
            placeholder="you@company.com"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-zinc-200">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none ring-0 focus:border-zinc-500"
            placeholder="Enter your password"
          />
        </label>

        <button
          type="button"
          className="mt-2 w-full rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200"
        >
          {submitLabel}
        </button>
      </form>

      <p className="mt-6 text-sm text-zinc-400">
        {altText}{" "}
        <Link href={altHref} className="font-medium text-zinc-100 hover:text-zinc-300">
          {altLabel}
        </Link>
      </p>
    </div>
  );
}
