/*
 * Bootstrap. Resolves the launch mode, boots the Phaser FX overlay (which
 * registers the KnockBox networking plugin when launched for multiplayer), and
 * mounts the Lit app shell. No Phaser scenes drive gameplay — the game loop runs
 * from <game-app>, and the FX canvas is purely decorative.
 */

import "./ui/styles/index.css";
import { attachKnockBoxSink, createLogger } from "./log";
import { detectLaunch } from "./net/launch";
import { AuthorityController } from "./net/authorityController";
import { fx } from "./ui/fx/fx";
// Side-effect import registers <game-app>; the type import is erased at build.
import "./ui/app/game-app";
import type { GameApp } from "./ui/app/game-app";

const log = createLogger("boot");

/** Surface otherwise-silent runtime failures (uncaught errors, rejected promises). */
function installGlobalErrorHandlers(): void {
  window.addEventListener("error", (e) => {
    log.critical(`uncaught error: ${e.message}`, e.error ?? e);
  });
  window.addEventListener("unhandledrejection", (e) => {
    log.error(`unhandled promise rejection: ${String(e.reason)}`, e.reason);
  });
}

function boot(): void {
  // Resolve the launch mode ONCE, up front. The KnockBox plugin scrubs the ticket
  // out of location.hash the moment it starts, so detectLaunch() is only reliable
  // before the Phaser game boots — capture it here and thread it down.
  const launchMode = detectLaunch();
  log.info(`booting (launch=${launchMode})`);

  // Boot the Phaser FX overlay into #fx, registering the KnockBox networking
  // plugin when launched for multiplayer (platform ticket or ?kbLocal=tab).
  fx.init("fx", launchMode);

  // Route logs to the KnockBox server logger once the plugin is attached. The
  // getter is resolved lazily per log call, so the plugin's async startup and
  // solo mode (no plugin → undefined) are both handled transparently.
  attachKnockBoxSink(() => fx.knockbox()?.log);

  // Build the controller HERE, synchronously, while we are still in the same task
  // that booted the FX game. KBAuthority requests its first snapshot from the
  // transport's `ready` event, and the plugin can fire that as soon as it starts —
  // so anything that defers (a microtask, an element lifecycle hook) risks missing
  // it. AuthorityController also carries a re-request guard for the same reason.
  const net = fx.knockbox();
  const app = document.querySelector("game-app") as GameApp;
  app.launchMode = launchMode;
  fx.setShakeTarget(app);

  if (!net) throw new Error("KnockBox plugin was not registered — cannot start the game");
  app.attach(new AuthorityController(net));
  log.info("app shell mounted");

  // Dismiss the loading screen.
  const bootEl = document.getElementById("boot");
  if (bootEl) {
    bootEl.classList.add("is-done");
    window.setTimeout(() => bootEl.remove(), 600);
  }

  if (import.meta.env.DEV) {
    (window as unknown as { __fx?: unknown; __app?: unknown }).__fx = fx;
    (window as unknown as { __fx?: unknown; __app?: unknown }).__app = app;
  }
}

/** Surface a fatal boot failure in the first-paint loading screen rather than
 *  leaving the user on a blank / forever-shimmering screen. */
function showBootFailure(): void {
  const bootEl = document.getElementById("boot");
  if (!bootEl) return;
  bootEl.classList.remove("is-done"); // keep it visible
  const sub = bootEl.querySelector(".boot-sub");
  if (sub) sub.textContent = "couldn't load — please reload";
  bootEl.querySelector(".boot-bar")?.remove();
}

installGlobalErrorHandlers();
try {
  boot();
} catch (err: unknown) {
  log.critical(`boot failed: ${String(err)}`, err);
  showBootFailure();
}
