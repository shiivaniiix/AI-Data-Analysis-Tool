"use client";

import { useEffect, useState } from "react";

import { getToken } from "@/utils/storage";

export type UseAuthResult = {
  /** True until client has read localStorage (SSR/first paint stay in sync). */
  loading: boolean;
  /** Whether a token was found after load. */
  isLoggedIn: boolean;
  /** API bearer token; null while loading or if logged out. */
  token: string | null;
};

type AuthSnapshot = {
  loading: boolean;
  token: string | null;
};

/**
 * Client-only auth snapshot from localStorage. Initial render matches SSR (loading, no token)
 * to avoid hydration mismatches.
 */
export function useAuth(): UseAuthResult {
  const [snapshot, setSnapshot] = useState<AuthSnapshot>({
    loading: true,
    token: null,
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only auth hydration gate
    setSnapshot({ loading: false, token: getToken() });
  }, []);

  return {
    loading: snapshot.loading,
    isLoggedIn: Boolean(snapshot.token),
    token: snapshot.token,
  };
}
