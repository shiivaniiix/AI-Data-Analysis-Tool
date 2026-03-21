"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { getUsername } from "@/utils/storage";

type ProfileChipProps = {
  username?: string | null;
};

export function ProfileChip({ username }: ProfileChipProps) {
  const router = useRouter();
  const resolvedUsername = username ?? getUsername() ?? "User";
  const initial = useMemo(
    () => (resolvedUsername.trim().charAt(0) || "U").toUpperCase(),
    [resolvedUsername],
  );

  return (
    <button
      type="button"
      onClick={() => router.push("/profile")}
      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/60 px-2.5 py-1.5 text-xs text-zinc-200 transition-all duration-200 hover:border-saas-primary/35 hover:bg-zinc-800/80"
      aria-label="Open profile"
    >
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-linear-to-br from-saas-primary/70 to-saas-accent/70 text-xs font-semibold text-white shadow-sm">
        {initial}
      </span>
      <span className="max-w-[140px] truncate text-sm font-medium text-zinc-100">{resolvedUsername}</span>
    </button>
  );
}
