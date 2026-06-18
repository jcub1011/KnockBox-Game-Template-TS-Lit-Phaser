/*
 * App-wide logging facade.
 *
 * A single dependency-free singleton so engine-agnostic game code (src/game/*,
 * which never touches Phaser) logs exactly like the UI does. Every line fans out
 * to two sinks:
 *   - the dev console (gated to DEV builds for trace/debug/info/warn; error and
 *     critical always print so production bug reports keep a trail), and
 *   - the KnockBox server logger when a multiplayer plugin is attached.
 *
 * The KnockBox logger lives on the plugin instance and only exists in
 * multiplayer modes, so it is resolved lazily through a getter wired once at
 * boot (see main.ts). Before the plugin is ready, or in solo mode, that sink is
 * a no-op — best-effort, matching the addon's own contract. Only the (already
 * prefixed) message string is shipped to the server; rich `detail` args stay on
 * the local console and are never sent over the wire. Callers MUST keep PII
 * (player names, submitted words) out of the message string and pass it as a
 * detail arg instead — the shipped line should carry only opaque ids.
 */

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "critical";

/** The console-like logger the KnockBox plugin exposes (mirror of its .d.ts). */
export interface KnockBoxLogger {
  trace(message: string): void;
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  critical(message: string): void;
}

/** A category-scoped logger. `detail` args are console-only (never shipped). */
export interface Logger {
  trace(message: string, ...detail: unknown[]): void;
  debug(message: string, ...detail: unknown[]): void;
  info(message: string, ...detail: unknown[]): void;
  warn(message: string, ...detail: unknown[]): void;
  error(message: string, ...detail: unknown[]): void;
  critical(message: string, ...detail: unknown[]): void;
}

/** Which console method backs each level (trace/debug collapse to console.debug). */
const CONSOLE_METHOD: Record<LogLevel, "debug" | "info" | "warn" | "error"> = {
  trace: "debug",
  debug: "debug",
  info: "info",
  warn: "warn",
  error: "error",
  critical: "error",
};

/** Levels that always reach the console, even in production builds. */
const ALWAYS_CONSOLE: ReadonlySet<LogLevel> = new Set<LogLevel>(["error", "critical"]);

const DEV: boolean = import.meta.env.DEV;

/** Lazily resolves the KnockBox logger; null until wired (and in solo mode). */
let knockBoxGetter: (() => KnockBoxLogger | undefined) | null = null;

/**
 * Point the KnockBox sink at a logger source. The getter is invoked per log
 * call, so it tolerates the plugin's async startup (returns undefined until
 * ready) and solo mode (always undefined). Call once at boot.
 */
export function attachKnockBoxSink(getter: () => KnockBoxLogger | undefined): void {
  knockBoxGetter = getter;
}

function emit(level: LogLevel, category: string, message: string, detail: unknown[]): void {
  const line = `[${category}] ${message}`;
  const kb = knockBoxGetter?.();

  // Console sink — in DEV, always for error/critical, AND whenever we're also shipping
  // to the server: the server send is best-effort (bounded, drop-oldest, swallowed
  // failures), so a local console copy preserves the line if a frame is lost on transport.
  if (DEV || ALWAYS_CONSOLE.has(level) || kb) {
    console[CONSOLE_METHOD[level]](line, ...detail);
  }

  // KnockBox server sink — best-effort, message only (no game state on the wire).
  if (kb) {
    try {
      kb[level](line);
    } catch {
      // Logging must never break the game; drop a failed server send.
    }
  }
}

/** Create a category-scoped logger, e.g. `const log = createLogger("match")`. */
export function createLogger(category: string): Logger {
  return {
    trace: (m, ...d) => emit("trace", category, m, d),
    debug: (m, ...d) => emit("debug", category, m, d),
    info: (m, ...d) => emit("info", category, m, d),
    warn: (m, ...d) => emit("warn", category, m, d),
    error: (m, ...d) => emit("error", category, m, d),
    critical: (m, ...d) => emit("critical", category, m, d),
  };
}
