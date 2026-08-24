/*
 * Builds the Phaser global-plugin config for the launch mode, and — for the two
 * server-less modes — wires this game's REAL authority module in as a virtual
 * server actor.
 *
 * That last part is the point of this file. `solo` and `local-tab` both run
 * `createAuthority` locally through the addon's emulation, so every peer gets
 * `ready` with `isHost:false` / `authority:'server'` and every frame takes the
 * byte-identical path it will take against the real server. There is no
 * "single-player code path" that can rot — and the emulation's fidelity checks
 * (strict-JSON boundary, poisoned `Date`) catch sandbox violations during
 * `npm run dev` instead of after deployment.
 *
 * ── The addons are UMD ──
 * The build runs them through CommonJS interop, so each module's api is the
 * DEFAULT export and nothing is attached to globalThis. A raw <script> load hits
 * the global branch instead, so we fall back to the globals for that case.
 * `./phaserGlobal` must be imported FIRST so globalThis.Phaser is set before the
 * UMD factories evaluate (they read it, and only build the plugin classes if it's
 * there).
 */

import "./phaserGlobal";
// Importing kb-core also guarantees it is bundled and evaluated before the plugin
// module, whose factory requires it.
import KnockBoxCore from "../../addons/knockbox/kb-core.js";
import KnockBoxPluginImport from "../../addons/knockbox/knockbox-plugin.js";
import KnockBoxLocalImport from "../../addons/knockbox/knockbox-local.js";
/*
 * NOTE: this pulls the authority module into the CLIENT bundle.
 *
 * Fine for this template — its rules hold no secrets. It is NOT fine for a
 * hidden-information game (secret roles, hands, an answer word): the real server
 * deliberately never serves `authority.js` to clients, and importing it here would
 * hand every player the secret anyway. For those games, use the URL form instead —
 * `authority: "./authority.js"` — which the local peer fetches, import-scans and
 * dynamic-imports at runtime; put a dev copy in `public/` so it is served locally
 * but is not statically reachable from the client graph.
 */
import { createAuthority } from "../authority/authority";
import type { KnockBoxLocalOptions } from "../../addons/knockbox/knockbox-phaser";
import type { LaunchMode } from "./launch";

interface KnockBoxGlobals {
  KnockBoxPlugin?: unknown;
  KnockBoxLocalPlugin?: unknown;
  KnockBoxCore?: unknown;
}

const g = globalThis as unknown as KnockBoxGlobals;
// Belt-and-suspenders: make kb-core reachable via the global the UMD factories read
// on the script-tag path (harmless when the import already wired it via require()).
g.KnockBoxCore ??= (KnockBoxCore as unknown) ?? g.KnockBoxCore;

/** The real WebSocket plugin — from the module export, or the global on a script load. */
const RealPlugin: unknown = (KnockBoxPluginImport as unknown) ?? g.KnockBoxPlugin;
/** The no-server plugin. Null unless Phaser was loaded first — it subclasses BasePlugin. */
const LocalPlugin: unknown = KnockBoxLocalImport?.KnockBoxLocalPlugin ?? g.KnockBoxLocalPlugin;

/** Phaser global-plugin config for the launch mode, or null if the class is missing. */
export function knockboxPluginConfig(mode: LaunchMode): Record<string, unknown> | null {
  if (mode === "platform") {
    // The KnockBox server loads and runs authority.js itself, one instance per
    // lobby. The client passes nothing extra — `sendToHost` already routes to it.
    return RealPlugin
      ? { key: "KnockBox", plugin: RealPlugin, start: true, mapping: "knockbox" }
      : null;
  }

  // solo and local-tab: emulate the server actor in-process with the real module.
  const data: KnockBoxLocalOptions = {
    mode: mode === "local-tab" ? "tab" : "solo",
    authority: createAuthority,
  };
  return LocalPlugin
    ? { key: "KnockBox", plugin: LocalPlugin, start: true, mapping: "knockbox", data }
    : null;
}
