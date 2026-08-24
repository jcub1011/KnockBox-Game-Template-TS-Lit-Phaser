/*
 * Canary for the UMD → ESM interop.
 *
 * The addons in `addons/knockbox/` are UMD, Vitest runs in Node, and what makes
 * `import X from "…/addon.js"` work here is the serve-time shim in vite.config.ts
 * (Vitest resolves its config with `command: 'serve'`). If a future Vite or Vitest
 * change breaks that, it fails HERE with an obvious message rather than as a
 * mystifying failure deep inside a gameplay test.
 *
 * Note which files are safe to import under Node: `knockbox-plugin.js` is NOT —
 * its factory throws unless Phaser is already on globalThis. `kb-core.js`,
 * `knockbox-local.js` and `kb-authority.js` all fall back to a hand-rolled
 * emitter when Phaser is absent, which is why the networking tests use those.
 */

import { describe, expect, it } from "vitest";
import KBAuthority from "../../addons/knockbox/kb-authority.js";
import KnockBoxLocal from "../../addons/knockbox/knockbox-local.js";

describe("addon interop", () => {
  it("kb-authority.js exposes KBAuthority as the default export", () => {
    expect(KBAuthority).toBeTypeOf("function");
  });

  it("knockbox-local.js exposes the Phaser-free local peer", () => {
    expect(KnockBoxLocal.KnockBoxLocalPeer).toBeTypeOf("function");
    expect(KnockBoxLocal._resetLocalHubs).toBeTypeOf("function");
  });

  it("builds no KnockBoxLocalPlugin without Phaser — which is why tests use the peer", () => {
    // The plugin subclasses Phaser.Plugins.BasePlugin, so the addon only defines
    // it when Phaser is on globalThis. In the browser `src/net/phaserGlobal.ts`
    // puts it there before these factories evaluate; under Node it stays null.
    expect(KnockBoxLocal.KnockBoxLocalPlugin).toBeNull();
  });

  it("ships the single-file import scan the packer also runs", () => {
    expect(KnockBoxLocal.scanAuthorityImports).toBeTypeOf("function");
    // An authority module may not have top-level imports — the server configures
    // no module loader. Our build inlines them; this is the check that proves it.
    expect(() => KnockBoxLocal.scanAuthorityImports(`import x from "./y.js";`)).toThrow();
    expect(() =>
      KnockBoxLocal.scanAuthorityImports(
        `export function createAuthority(){} export const config={};`,
      ),
    ).not.toThrow();
  });
});
