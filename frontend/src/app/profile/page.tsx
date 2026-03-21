"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

import { AuthLoadingScreen } from "@/components/auth-loading-screen";
import { ButtonSpinner } from "@/components/button-spinner";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/api";
import { UserMessage, userFacingError } from "@/lib/user-messages";
import { buttonMotion } from "@/lib/motion-presets";
import { clearSession, setUserEmail, setUsername } from "@/utils/storage";

type ProfileResponse = {
  id: string;
  email: string;
  username: string;
  is_verified: boolean;
};

export default function ProfilePage() {
  const router = useRouter();
  const { token, loading: authLoading, isLoggedIn } = useAuth();

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newUsername, setNewUsername] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [emailOtpStep, setEmailOtpStep] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const avatarLetter = useMemo(
    () => (profile?.username?.trim().charAt(0) || "U").toUpperCase(),
    [profile?.username],
  );

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn || !token) {
      router.push("/login");
      return;
    }
    void loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isLoggedIn, token, router]);

  const loadProfile = async () => {
    if (!token) return;
    setLoadingProfile(true);
    setError(null);
    try {
      const me = await apiRequest<ProfileResponse>("/auth/profile", { token });
      setProfile(me);
      setNewUsername(me.username);
      setNewEmail(me.email);
      setUsername(me.username);
      setUserEmail(me.email);
    } catch (err) {
      setError(userFacingError(err, UserMessage.network));
    } finally {
      setLoadingProfile(false);
    }
  };

  const onLogout = () => {
    clearSession();
    router.push("/login");
  };

  const onSaveUsername = async () => {
    if (!token || !newUsername.trim()) return;
    setSavingUsername(true);
    setError(null);
    try {
      const updated = await apiRequest<ProfileResponse>("/auth/profile/username", {
        method: "POST",
        token,
        body: { username: newUsername.trim() },
      });
      setProfile(updated);
      setNewUsername(updated.username);
      setUsername(updated.username);
    } catch (err) {
      setError(userFacingError(err, UserMessage.network));
    } finally {
      setSavingUsername(false);
    }
  };

  const onStartEmailChange = async () => {
    if (!token || !newEmail.trim()) return;
    setEmailLoading(true);
    setError(null);
    try {
      await apiRequest<{ message: string }>("/auth/profile/email/start", {
        method: "POST",
        token,
        body: { new_email: newEmail.trim() },
      });
      setEmailOtpStep(true);
    } catch (err) {
      setError(userFacingError(err, UserMessage.network));
    } finally {
      setEmailLoading(false);
    }
  };

  const onVerifyEmailChange = async () => {
    if (!token || !newEmail.trim() || !emailOtp.trim()) return;
    setEmailLoading(true);
    setError(null);
    try {
      const updated = await apiRequest<ProfileResponse>("/auth/profile/email/verify", {
        method: "POST",
        token,
        body: { new_email: newEmail.trim(), otp: emailOtp.trim() },
      });
      setProfile(updated);
      setNewEmail(updated.email);
      setUserEmail(updated.email);
      setEmailOtpStep(false);
      setEmailOtp("");
    } catch (err) {
      setError(userFacingError(err, UserMessage.network));
    } finally {
      setEmailLoading(false);
    }
  };

  const onDeleteAccount = async () => {
    if (!token || !deletePassword) return;
    setDeleting(true);
    setError(null);
    try {
      await apiRequest("/auth/delete-account", {
        method: "POST",
        token,
        body: { password: deletePassword },
      });
      clearSession();
      router.push("/");
    } catch (err) {
      setError(userFacingError(err, UserMessage.deleteAccount));
    } finally {
      setDeleting(false);
    }
  };

  if (authLoading || loadingProfile) {
    return <AuthLoadingScreen message="Loading profile…" />;
  }
  if (!token) {
    return <AuthLoadingScreen message="Redirecting…" />;
  }

  return (
    <main className="min-h-screen bg-linear-to-br from-zinc-950 via-saas-primary/12 to-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-saas-primary/40 hover:bg-zinc-800/80"
          >
            ← Back to Dashboard
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-saas-primary/40 hover:bg-zinc-800/80"
          >
            Logout
          </button>
        </div>

        <div className="rounded-2xl border border-white/8 bg-linear-to-br from-zinc-900/92 to-saas-primary/10 p-6 shadow-xl shadow-black/20">
          <div className="flex items-center gap-4">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-br from-saas-primary to-saas-accent text-xl font-semibold text-white">
              {avatarLetter}
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white">{profile?.username ?? "Profile"}</h1>
              <p className="text-sm text-zinc-400">{profile?.email ?? ""}</p>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-900/50 bg-rose-950/20 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-5">
          <section className="rounded-2xl border border-white/8 bg-zinc-900/70 p-6">
            <h2 className="text-lg font-semibold text-white">Profile Info</h2>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-300">Username</span>
                <input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/90 px-3 py-2 text-sm text-zinc-100 outline-none transition-all duration-200 focus:border-saas-primary/50 focus:ring-2 focus:ring-saas-primary/25 focus:ring-offset-0"
                />
              </label>
              <motion.button
                type="button"
                onClick={() => void onSaveUsername()}
                disabled={savingUsername}
                {...(!savingUsername ? buttonMotion : {})}
                className="rounded-xl bg-linear-to-br from-saas-primary to-saas-accent px-4 py-2 text-sm font-semibold text-white shadow-md shadow-saas-primary/25 disabled:opacity-70"
              >
                {savingUsername ? "Saving..." : "Update Username"}
              </motion.button>
            </div>
          </section>

          <section className="rounded-2xl border border-white/8 bg-zinc-900/70 p-6">
            <h2 className="text-lg font-semibold text-white">Security</h2>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-300">Email</span>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/90 px-3 py-2 text-sm text-zinc-100 outline-none transition-all duration-200 focus:border-saas-primary/50 focus:ring-2 focus:ring-saas-primary/25 focus:ring-offset-0"
                />
              </label>

              {!emailOtpStep ? (
                <motion.button
                  type="button"
                  onClick={() => void onStartEmailChange()}
                  disabled={emailLoading}
                  {...(!emailLoading ? buttonMotion : {})}
                  className="rounded-xl bg-linear-to-br from-saas-primary to-saas-accent px-4 py-2 text-sm font-semibold text-white shadow-md shadow-saas-primary/25 disabled:opacity-70"
                >
                  {emailLoading ? "Sending OTP..." : "Change Email (Send OTP)"}
                </motion.button>
              ) : (
                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-zinc-300">Verify OTP</span>
                    <input
                      value={emailOtp}
                      onChange={(e) => setEmailOtp(e.target.value)}
                      placeholder="6-digit OTP"
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950/90 px-3 py-2 text-sm text-zinc-100 outline-none transition-all duration-200 focus:border-saas-primary/50 focus:ring-2 focus:ring-saas-primary/25 focus:ring-offset-0"
                    />
                  </label>
                  <motion.button
                    type="button"
                    onClick={() => void onVerifyEmailChange()}
                    disabled={emailLoading}
                    {...(!emailLoading ? buttonMotion : {})}
                    className="rounded-xl bg-linear-to-br from-saas-primary to-saas-accent px-4 py-2 text-sm font-semibold text-white shadow-md shadow-saas-primary/25 disabled:opacity-70"
                  >
                    {emailLoading ? "Verifying..." : "Verify & Update Email"}
                  </motion.button>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-rose-900/40 bg-rose-950/20 p-6">
            <h2 className="text-lg font-semibold text-rose-300">Danger Zone</h2>
            <div className="mt-4 space-y-3">
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Enter password to delete account"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950/90 px-3 py-2 text-sm text-zinc-100 outline-none transition-all duration-200 focus:border-rose-400/50 focus:ring-2 focus:ring-rose-400/25 focus:ring-offset-0"
              />
              <motion.button
                type="button"
                onClick={() => void onDeleteAccount()}
                disabled={deleting}
                {...(!deleting ? buttonMotion : {})}
                className="flex items-center gap-2 rounded-xl bg-linear-to-br from-rose-600 to-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-rose-900/35 disabled:opacity-70"
              >
                {deleting ? (
                  <>
                    <ButtonSpinner className="border-white" />
                    Deleting...
                  </>
                ) : (
                  "Delete Account"
                )}
              </motion.button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
