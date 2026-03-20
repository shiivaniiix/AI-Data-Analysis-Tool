"use client";

import Link from "next/link";
import { useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";

type SignupResponse = {
  message: string;
  verification_required: boolean;
  dev_otp?: string | null;
};

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const data = await apiRequest<SignupResponse>("/auth/signup", {
        method: "POST",
        body: { email, username, password },
      });
      setOtpStep(true);
      setDevOtp(data.dev_otp ?? null);
      setSuccessMessage("Account created. Enter the OTP (check backend logs in dev mode).");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create account.");
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
            <p className="text-xs text-zinc-500">
              In development, OTP is printed in backend terminal.
            </p>
            {devOtp ? (
              <p className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
                Development mode: your OTP is{" "}
                <span className="font-semibold text-zinc-200">{devOtp}</span>
              </p>
            ) : null}
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
