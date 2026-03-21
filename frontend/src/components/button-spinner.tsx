"use client";

type ButtonSpinnerProps = {
  /** Tailwind border color class for the spinner ring (e.g. border-zinc-900, border-white) */
  className?: string;
};

/** Subtle inline spinner for primary buttons during async actions */
export function ButtonSpinner({ className = "border-zinc-900" }: ButtonSpinnerProps) {
  return (
    <span
      aria-hidden
      className={`inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-t-transparent ${className}`}
    />
  );
}
