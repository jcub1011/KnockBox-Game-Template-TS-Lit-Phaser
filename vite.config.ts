import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

/**
 * The KnockBox addons are vendored UMD (.js) modules. The production build runs
 * them through Rollup's CommonJS interop, so `import X from "...addon.js"` gets a
 * synthetic default export (the factory's `module.exports`). The dev server serves
 * source as native ESM, where the UMD wrapper instead runs its `root.X = factory()`
 * global branch and exposes NO default export — so that static import throws
 * ("does not provide an export named 'default'").
 *
 * This dev-only plugin reproduces the build's CommonJS interop: it forces the UMD's
 * `module.exports` branch (by shimming `module` + a `require` that resolves the
 * inter-addon `./kb-core.js` dependency to its ESM import) and appends an ESM
 * `export default`. `root.Phaser` is read from globalThis, which `./phaserGlobal`
 * already populates before these factories evaluate. Build is untouched (serve only).
 */
function knockboxUmdDev(): Plugin {
  const re = /addons[\\/]knockbox[\\/](kb-core|knockbox-plugin|knockbox-local)\.js$/;
  return {
    name: "knockbox-umd-dev",
    apply: "serve",
    enforce: "pre",
    transform(code, id) {
      const match = id.split("?")[0].match(re);
      if (!match) return null;
      const needsCore = match[1] !== "kb-core";
      const prelude =
        (needsCore ? `import __kbCore from "/addons/knockbox/kb-core.js";\n` : "") +
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
