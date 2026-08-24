/*
 * Ambient module declarations for the UMD KnockBox addon .js files.
 *
 * Under our build (and under Vitest, via the serve-time shim in vite.config.ts)
 * each addon resolves through CommonJS interop, so its api is the DEFAULT export.
 * TypeScript cannot resolve `../../addons/knockbox/*.js` on disk — with
 * `moduleResolution: "bundler"` and `allowJs` off it looks for `.ts`/`.d.ts` and
 * finds only `.js` — so it falls through to these wildcard declarations.
 *
 * We point them at the addon's own hand-written `knockbox-phaser.d.ts`, which the
 * `knockbox addon` CLI installs alongside the .js files. That gives the app REAL
 * types (KBAuthority's generics, KnockBoxLocalOptions.authority, KBReadyInfo's
 * authority/ownerId/isOwner) instead of `unknown`, and they update automatically
 * with `knockbox addon update`.
 *
 * These declarations live here, not in addons/, because addons/ is CLI-managed:
 * any hand-written file in there is at risk on the next update, and any EDIT to a
 * managed file makes `knockbox addon check` report MODIFIED.
 */

declare module "*/kb-core.js" {
  // Never referenced from TS — imported only to guarantee it is bundled and
  // evaluated before the plugin factories that require() it.
  const core: unknown;
  export default core;
}

declare module "*/knockbox-plugin.js" {
  import { KnockBoxPlugin } from "../../addons/knockbox/knockbox-phaser";
  export default KnockBoxPlugin;
}

declare module "*/kb-authority.js" {
  import { KBAuthority } from "../../addons/knockbox/knockbox-phaser";
  export default KBAuthority;
}

declare module "*/knockbox-local.js" {
  import { KnockBoxLocalPeer, KnockBoxLocalPlugin } from "../../addons/knockbox/knockbox-phaser";
  const api: {
    /** Null unless Phaser was loaded first — the class subclasses Phaser.Plugins.BasePlugin. */
    KnockBoxLocalPlugin: typeof KnockBoxLocalPlugin | null;
    KnockBoxLocalPeer: typeof KnockBoxLocalPeer;
    /** Throws if a module source has top-level imports (authority modules are single-file). */
    scanAuthorityImports(source: string): void;
    /** Test helper: clear the in-process hub registry between tests. */
    _resetLocalHubs(): void;
  };
  export default api;
}
