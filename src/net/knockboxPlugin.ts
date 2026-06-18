/*
 * Bridges the shipped KnockBox addon (UMD .js) into the typed app.
 *
 * The addon files are UMD. Our Vite/Rollup build sees their `module.exports` /
 * `require(...)` and treats them as CommonJS, so the UMD wrapper takes its
 * `module.exports` branch — i.e. each module's class/api is the DEFAULT EXPORT,
 * and it does NOT attach anything to `globalThis`. (A raw `<script>` load would
 * instead hit the global branch.) So we import the exports directly and fall back
 * to the globals for the script-tag case. `./phaserGlobal` must be imported first
 * so `globalThis.Phaser` is set before the addon factories evaluate (they read it).
 */

import "./phaserGlobal";
// kb-core's factory result; importing it also guarantees it's bundled + evaluated
// before the plugin module (whose factory requires it).
import KnockBoxCore from "../../addons/knockbox/kb-core.js";
// The real WebSocket plugin class (default export under our build).
import KnockBoxPluginImport from "../../addons/knockbox/knockbox-plugin.js";
// The local (no-server) drop-in: default export is { KnockBoxLocalPlugin, KnockBoxLocalPeer }.
import KnockBoxLocalImport from "../../addons/knockbox/knockbox-local.js";
import type { LaunchMode } from "./launch";

interface KnockBoxGlobals {
  KnockBoxPlugin?: unknown;
  KnockBoxLocalPlugin?: unknown;
  KnockBoxCore?: unknown;
}

const g = globalThis as unknown as KnockBoxGlobals;
// Belt-and-suspenders: make kb-core reachable via the global the UMD factories read
// on the script-tag path (harmless when the import path already wired it via require()).
g.KnockBoxCore ??= (KnockBoxCore as unknown) ?? g.KnockBoxCore;

/** The real WebSocket plugin — from the module export, or the global on a script load. */
const RealPlugin: unknown = (KnockBoxPluginImport as unknown) ?? g.KnockBoxPlugin;
/** The local-tab plugin — destructured from the module export, or the global. */
const LocalPlugin: unknown =
  (KnockBoxLocalImport as { KnockBoxLocalPlugin?: unknown } | undefined)?.KnockBoxLocalPlugin ??
  g.KnockBoxLocalPlugin;

/** Phaser global-plugin config for the launch mode (null in solo mode). */
export function knockboxPluginConfig(mode: LaunchMode): Record<string, unknown> | null {
  if (mode === "solo") return null;
  const plugin = mode === "local-tab" ? LocalPlugin : RealPlugin;
  if (!plugin) return null;
  const data = mode === "local-tab" ? { mode: "tab" } : undefined;
  return { key: "KnockBox", plugin, start: true, mapping: "knockbox", data };
}
