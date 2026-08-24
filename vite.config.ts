import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

/**
 * The KnockBox addons in `addons/knockbox/` are UMD (.js) modules. The production
 * build runs them through the bundler's CommonJS interop, so the UMD wrapper takes
 * its `module.exports` branch — i.e. each module's class/api is the DEFAULT EXPORT,
 * and it does NOT attach anything to `globalThis`. (A raw `<script>` load would
 * instead hit the global branch.) The dev server serves source as native ESM,
 * where the UMD wrapper runs its `root.X = factory()` global branch and exposes NO
 * default export — so the static import throws ("does not provide an export named
 * 'default'").
 *
 * This dev-only plugin reproduces the build's CommonJS interop: it forces the UMD's
 * `module.exports` branch and appends an ESM `export default`. `root.Phaser` is read
 * from globalThis, which `src/net/phaserGlobal.ts` populates before these factories
 * evaluate. Build is untouched (serve only).
 *
 * Vitest also resolves its config with `command: 'serve'`, so this shim is what
 * makes `import ... from "addons/knockbox/*.js"` work in tests too.
 */
function knockboxUmdDev(): Plugin {
  const re = /addons[\\/]knockbox[\\/](kb-core|knockbox-plugin|knockbox-local|kb-authority)\.js$/;
  return {
    name: "knockbox-umd-dev",
    apply: "serve",
    enforce: "pre",
    transform(code, id) {
      const match = id.split("?")[0].match(re);
      if (!match) return null;
      // Only these two take kb-core: their CJS branch is
      // `factory(require('./kb-core.js'), root.Phaser)`. kb-authority's is
      // `factory(root.Phaser)` and kb-core's is `factory()`, so injecting a
      // require() shim for those would be dead code.
      const needsCore = match[1] === "knockbox-plugin" || match[1] === "knockbox-local";
      const prelude =
        // Relative, not root-absolute: this resolves against the transformed
        // module's own id, which is correct in the dev server AND under Vitest's
        // module runner (where a root-absolute id depends on Vite's `root`).
        (needsCore ? `import __kbCore from "./kb-core.js";\n` : "") +
        `const module = { exports: {} };\n` +
        (needsCore
          ? `const require = (dep) => { if (/kb-core(\\.js)?$/.test(dep)) return __kbCore; ` +
            `throw new Error("knockbox dev shim: unexpected require(" + dep + ")"); };\n`
          : "");
      return { code: `${prelude}${code}\nexport default module.exports;\n`, map: null };
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [knockboxUmdDev()],
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 2000,
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
