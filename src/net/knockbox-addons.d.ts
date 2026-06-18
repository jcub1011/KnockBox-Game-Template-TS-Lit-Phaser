/*
 * Ambient module declarations for the UMD KnockBox addon .js files. Under our
 * Vite/Rollup build these resolve via `module.exports`, so each exposes a DEFAULT
 * export (see knockboxPlugin.ts). The hand-written knockbox-phaser.d.ts documents
 * the runtime shapes; here we only need enough typing to import the defaults
 * without tripping noImplicitAny. The classes are passed opaquely to Phaser's
 * plugin config, so `unknown` is sufficient.
 */

declare module "*/kb-core.js" {
  const core: unknown;
  export default core;
}

declare module "*/knockbox-plugin.js" {
  const plugin: unknown;
  export default plugin;
}

declare module "*/knockbox-local.js" {
  const api: {
    KnockBoxLocalPlugin?: unknown;
    KnockBoxLocalPeer?: unknown;
    _resetLocalHubs?: unknown;
  };
  export default api;
}

declare module "*/kb-authority.js" {
  const KBAuthority: unknown;
  export default KBAuthority;
}
