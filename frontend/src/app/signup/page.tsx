"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ButtonSpinner } from "@/components/button-spinner";
import { apiRequest } from "@/lib/api";
import { UserMessage, userFacingError } from "@/lib/user-messages";
import { buttonMotion, fadeInUp } from "@/lib/motion-presets";

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
      setError(userFacingError(err, UserMessage.signup));
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
      setError(userFacingError(err, UserMessage.verifyOtp));
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
      setError(userFacingError(err, UserMessage.resendOtp));
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-linear-to-br from-zinc-950 via-saas-primary/10 to-zinc-950 px-6 py-20">
      <motion.div
        {...fadeInUp}
        className="w-full max-w-md rounded-2xl border border-white/8 bg-linear-to-br from-zinc-900/92 via-zinc-900/75 to-saas-primary/12 p-8 shadow-2xl shadow-saas-primary/15 backdrop-blur-xl transition-all duration-300 hover:border-white/10 hover:shadow-saas-primary/20"
      >
        <h1 className="bg-linear-to-r from-white via-saas-primary/80 to-saas-accent bg-clip-text text-2xl font-semibold tracking-tight text-transparent">
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
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950/90 px-3 py-2 text-zinc-100 outline-none transition-all duration-200 focus:border-saas-primary/50 focus:ring-2 focus:ring-saas-primary/25 focus:ring-offset-0"
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
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950/90 px-3 py-2 text-zinc-100 outline-none transition-all duration-200 focus:border-saas-primary/50 focus:ring-2 focus:ring-saas-primary/25 focus:ring-offset-0"
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
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950/90 px-3 py-2 text-zinc-100 outline-none transition-all duration-200 focus:border-saas-primary/50 focus:ring-2 focus:ring-saas-primary/25 focus:ring-offset-0"
                placeholder="Minimum 8 characters"
              />
            </label>
            <motion.button
              type="submit"
              disabled={loading}
              {...(!loading ? buttonMotion : {})}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-br from-saas-primary to-saas-accent px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-saas-primary/25 transition-shadow duration-200 hover:shadow-xl hover:shadow-saas-primary/35 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <>
                  <ButtonSpinner className="border-white" />
                  Creating...
                </>
              ) : (
                "Create Account"
              )}
            </motion.button>
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
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950/90 px-3 py-2 text-zinc-100 outline-none transition-all duration-200 focus:border-saas-primary/50 focus:ring-2 focus:ring-saas-primary/25 focus:ring-offset-0"
                placeholder="6-digit OTP"
              />
            </label>
            <p className="text-xs text-zinc-500">Enter the OTP sent to your email</p>
            <motion.button
              type="button"
              onClick={handleResendOtp}
              disabled={resendLoading || resendCooldown > 0 || loading}
              {...(!resendLoading && resendCooldown === 0 && !loading ? buttonMotion : {})}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-saas-primary/30 bg-zinc-950/50 px-4 py-2 text-sm font-medium text-zinc-100 shadow-md shadow-black/20 backdrop-blur transition-all duration-200 hover:scale-[1.01] hover:border-saas-accent/40 hover:bg-zinc-900/70 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
            >
              {resendLoading ? (
                <>
                  <ButtonSpinner className="border-saas-accent/90" />
                  Resending...
                </>
              ) : resendCooldown > 0 ? (
                `Resend OTP in ${resendCooldown}s`
              ) : (
                "Resend OTP"
              )}
            </motion.button>
            <motion.button
              type="submit"
              disabled={loading}
              {...(!loading ? buttonMotion : {})}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-br from-saas-primary to-saas-accent px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-saas-primary/25 transition-shadow duration-200 hover:shadow-xl hover:shadow-saas-primary/35 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <>
                  <ButtonSpinner className="border-white" />
                  Verifying...
                </>
              ) : (
                "Verify OTP"
              )}
            </motion.button>
          </form>
        )}

        {error ? <p className="mt-4 text-sm text-rose-400">{error}</p> : null}
        {successMessage ? <p className="mt-4 text-sm text-emerald-400">{successMessage}</p> : null}

        <p className="mt-6 text-sm text-zinc-400">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-saas-accent/90 transition-colors duration-200 hover:text-saas-primary"
          >
            Log in
          </Link>
        </p>
      </motion.div>
    </main>
  );
}
