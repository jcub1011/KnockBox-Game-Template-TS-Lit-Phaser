/*
 * Visual constants + small helpers shared by the FX layer. Kept tiny on purpose —
 * grow it as the game's palette and motion needs take shape.
 */

/** Hex colors for Phaser FX (numbers, not CSS strings). */
export const COLORS = {
  cyan: 0x00e5ff,
  magenta: 0xff2e8b,
  mint: 0x14f195,
  amber: 0xffd23a,
  violet: 0xb97bff,
} as const;

/** Respect the user's reduced-motion preference — FX no-op when set. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
