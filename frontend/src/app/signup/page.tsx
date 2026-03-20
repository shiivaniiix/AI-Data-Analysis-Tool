"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";

type SignupResponse = {
  message: string;
  verification_required: boolean;
};

type MessageResponse = {
  message: string;
};

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const handleSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      await apiRequest<SignupResponse>("/auth/signup", {
        method: "POST",
        body: { email, username, password },
      });
      setOtpStep(true);
      setSuccessMessage("Account created. Enter the OTP sent to your email.");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to create account.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      await apiRequest("/auth/verify-otp", {
        method: "POST",
        body: { email, otp },
      });
      setSuccessMessage("Email verified successfully. You can now log in.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to verify OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!email || resendCooldown > 0) return;
    setError(null);
    setSuccessMessage(null);
    setResendLoading(true);
    try {
      const data = await apiRequest<MessageResponse>("/auth/resend-otp", {
        method: "POST",
        body: { email },
      });
      setSuccessMessage(data.message || "OTP resent successfully");
      setResendCooldown(30);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to resend OTP.");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-20">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8 shadow-xl">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Sign up and start chatting with your spreadsheets in minutes.
        </p>

        {!otpStep ? (
          <form className="mt-6 space-y-4" onSubmit={handleSignup}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-200">Email</span>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-zinc-500"
                placeholder="you@company.com"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-200">Username</span>
              <input
                required
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-zinc-500"
                placeholder="your_username"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-200">Password</span>
              <input
                required
                minLength={8}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-zinc-500"
                placeholder="Minimum 8 characters"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleVerifyOtp}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-200">
                Verification OTP
              </span>
              <input
                required
                inputMode="numeric"
                pattern="[0-9]{6}"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-zinc-500"
                placeholder="6-digit OTP"
              />
            </label>
            <p className="text-xs text-zinc-500">Enter the OTP sent to your email</p>
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resendLoading || resendCooldown > 0 || loading}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {resendLoading
                ? "Resending..."
                : resendCooldown > 0
                  ? `Resend OTP in ${resendCooldown}s`
                  : "Resend OTP"}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
          </form>
        )}

        {error ? <p className="mt-4 text-sm text-rose-400">{error}</p> : null}
        {successMessage ? <p className="mt-4 text-sm text-emerald-400">{successMessage}</p> : null}

        <p className="mt-6 text-sm text-zinc-400">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-zinc-100 hover:text-zinc-300">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
