/**
 * Shared Framer Motion presets — fast, subtle UI only.
 */

const ease = [0.22, 1, 0.36, 1] as const;

export const fadeInUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease },
} as const;

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.32, ease },
} as const;

export const slideInLeft = {
  initial: { opacity: 0, x: -12 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.36, ease },
} as const;

/** Main panel after sidebar — tiny stagger */
export const fadeInUpDelayed = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.34, ease, delay: 0.06 },
} as const;

/** Primary buttons: slight scale when interactive */
export const buttonMotion = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
  transition: { type: "spring" as const, stiffness: 420, damping: 28 },
};
